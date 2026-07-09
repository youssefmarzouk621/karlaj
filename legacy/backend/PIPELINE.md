# Backend Pipeline — How an Image Becomes a LEGO Mosaic

This document walks through **everything the backend does** from the moment it
receives an uploaded image to the moment it returns a mosaic + instruction PDF.
It is meant as a mental model for understanding the code and for spotting places
we can improve.

---

## 1. The 30,000-foot view

A single `POST /process` request flows through five stages. Each stage is a
separate module, and the output of one feeds the next.

```
   UPLOAD                                                          RESPONSE
     │                                                                ▲
     ▼                                                                │
┌─────────┐   ┌───────────┐   ┌────────────┐   ┌──────────┐   ┌────────────┐
│ main.py │──▶│processor  │──▶│color_      │──▶│brick_    │──▶│bag_        │
│         │   │.py        │   │palette.py  │   │fitter.py │   │organizer.py│
│validate │   │crop+resize│   │pixel→LEGO  │   │merge into│   │split into  │
│the file │   │(pixelize) │   │color match │   │bricks    │   │build bags  │
└─────────┘   └───────────┘   └────────────┘   └──────────┘   └────────────┘
                                                                     │
                                                                     ▼
                                                              ┌────────────┐
                                                              │pdf_        │
                                                              │generator.py│
                                                              │build the   │
                                                              │instructions│
                                                              └────────────┘
```

| Stage | File | Input | Output |
|-------|------|-------|--------|
| 1. Validate | `main.py` | HTTP upload (bytes, width, height) | validated bytes |
| **0. Analyze & route** | `image_analysis.py`, `filter_profiles.py` | cropped image | chosen filter recipe |
| 2. Pixelize | `processor.py` | image bytes | `width × height` RGB grid |
| **2.4 Unify backdrop** ¹ | `background.py` | cropped image | flat-backdrop image |
| **2.5 Flatten** ¹ | `filters.py` | working image | shade-flattened image |
| 3. Color-match | `color_palette.py` | RGB grid | grid of LEGO color IDs |
| **3.5 Despeckle** | `grid_cleanup.py` | color-ID grid | cleaned color-ID grid |
| 4. Brick-fit | `brick_fitter.py` | color-ID grid | list of brick placements |
| 5. Bag + PDF | `bag_organizer.py`, `pdf_generator.py` | placements | bags + printable PDF |

> ¹ The preprocessing filters (2.4, 2.5, and others) are **no longer fixed** —
> **Stage 0** analyzes each image and picks which of them run, and with what
> parameters. A studio portrait gets backdrop-unify + gentle mean-shift; a busy
> scene gets saturation/contrast + stronger mean-shift and *skips* backdrop-unify.
> See [Stage 0](#15-stage-0--image-analysis--filter-routing).
>
> Stages **2.4**, **2.5** and **3.5** were added to fix *shadow banding* — a
> shadow on the backdrop getting split into two LEGO colors with a hard seam.
> The three attack it at escalating levels: **2.4** repaints the whole backdrop
> one color, **2.5** flattens the subject, **3.5** cleans stray studs.

Everything is kept **in memory**. Results are stashed in a module-level
`jobs: dict` keyed by a random UUID so the PDF can be downloaded later via
`GET /pdf/{job_id}`.

---

## 1.5. Stage 0 — Image analysis & filter routing (`image_analysis.py`, `filter_profiles.py`)

**Why.** One fixed set of filters can't serve every photo. The backdrop-unify +
mean-shift recipe that cleans up a **studio portrait** (neutral wall) actively
*hurts* a **busy scene** (a wedding in front of flowers) — it leaves the subject
muddy and washed-out. So before any filtering, we measure the image and choose a
recipe tailored to it.

**Step 1 — measure** (`analyze_image`). A handful of cheap, normalized metrics:

| Metric | What it captures | ktyb | wedding |
|--------|------------------|------|---------|
| `colorfulness` | Hasler–Süsstrunk color richness | 0.24 | 0.39 |
| `busyness` | Canny edge density (detail/clutter) | 0.03 | 0.09 |
| `border_saturation` | how colorful the outer frame is (neutral backdrop?) | 0.13 | 0.31 |
| `mean_saturation` | overall vividness | 0.23 | 0.30 |
| `contrast` | luminance P95−P5 (gates the tone lift) | 0.64 | 0.72 |
| `brightness` | mean luminance (sets tone-lift gamma) | 0.47 | 0.45 |
| `aspect_ratio` | reserved for future crop logic | — | — |

**Step 2 — route** (`select_profile`) to one of three profiles:

```
  neutral border + low colorfulness + low busyness ─▶ studio_portrait
  colorful OR busy OR colorful border              ─▶ busy_scene
  otherwise                                        ─▶ default
```

**Step 3 — build the recipe** (`build_recipe`). The stack is deliberately **small
and orthogonal** — three steps, each doing one thing, none fighting the others:

| Profile | Recipe |
|---------|--------|
| *(all profiles)* | `tone_lift(gamma)` **first, if `contrast` < 0.52** — a *global* exposure fix for dull/low-key shots; darker images get a stronger (lower-gamma) lift, always gently clamped |
| `studio_portrait` | … → `unify_background` → `mean_shift(sp=19, sr=30)` |
| `busy_scene` / `default` | … → `mean_shift(sp=19, sr=30)` |

Why so few steps now (this replaced a 7-filter stack that regressed):
- **`tone_lift` is a global gamma on LAB lightness, not CLAHE.** CLAHE is *local*
  contrast; at low stud counts its per-tile equalization overshot into harsh,
  distorted faces. A global gamma brightens smoothly and can't create local
  artifacts.
- **`mean_shift` has one fixed, moderate `sr`** and runs at the fixed working
  resolution (below), so its effect no longer depends on the stud count.
- **Color handling lives in ONE place** — the chroma bias inside
  `color_palette.match_image` (Stage 3) keeps neutrals neutral and colors vivid.
  There is no separate saturation step to fight it.

Filters live in `filters.py` as small composable functions; `apply_recipe` runs
the chosen steps in order. Cleanup (Stage 3.5) always runs afterward, on the grid.

**Resolution robustness.** Preprocessing always runs at a **fixed working size**
(`processor.WORK_SIZE`, long side 512 px), regardless of the requested stud count —
so the filters see the same image whether the user asks for 48 or 96 studs; only
the final downsample differs. (Previously the working size scaled with the stud
grid, so a 48-stud request hit every filter twice as hard as a 96-stud one — that
is what made low-res outputs collapse into grey mush / harsh faces.)

**Transparency.** The chosen profile, metrics, and exact steps are returned in the
API response under `preprocessing`:

```json
"preprocessing": {
  "profile": "studio_portrait",
  "metrics": { "colorfulness": 0.22, "contrast": 0.46, ... },
  "steps": [ {"filter": "tone_lift", "params": {"gamma": 0.762}},
             {"filter": "unify_background", "params": {}},
             {"filter": "mean_shift", "params": {"sp": 19, "sr": 30}} ]
}
```

> **Guard rail.** `test_pipeline.py` asserts a studio image routes to
> `studio_portrait` (incl. `unify_background`), a busy image routes to
> `busy_scene` (no backdrop-unify), and a dark image gets `tone_lift` — so tuning
> one path can't silently regress another. `tools/contact_sheet.py` renders every
> input at 48/64/96 into one labeled sheet so regressions are caught by eye.
> Thresholds live as constants in
> `filter_profiles.py`, calibrated against ktyb.jpg vs wedding.JPG.

---

## 2. Stage 1 — Request validation (`main.py`)

Before any image processing happens, the endpoint enforces three guards:

```
width, height  ∈ [16, 96]      → else 400  "Dimensions must be between 16 and 96"
content_type   startswith image/ → else 400  "File must be an image"
size           ≤ 20 MB          → else 400  "Image must be under 20MB"
```

`width`/`height` are **stud counts**, not pixels — a `48×48` request means a
mosaic that is 48 LEGO studs wide and 48 studs tall.

---

## 3. Stage 2 — Pixelization (`processor.py`)

This is where a photo becomes a coarse grid. Two sub-steps: **crop** then
**resize**.

### 3a. Center-crop to the target aspect ratio

The requested mosaic has aspect ratio `width / height`. The source photo almost
never matches, so we crop the center to avoid stretching.

```
  Source photo (wide)              target ratio = 1:1 (48×48)
  ┌───────────────────────┐
  │        │       │      │        Crop off the left & right,
  │  cut   │ KEEP  │ cut  │  ───▶  keep the centered square.
  │        │       │      │
  └───────────────────────┘
        left = (img.width - new_w) // 2
```

- If the photo is **wider** than the target → crop left/right.
- If the photo is **taller** than the target → crop top/bottom.

### 3b. Resize down to stud dimensions ("the pixelization")

```python
img = img.resize((width, height), Image.LANCZOS)
pixels = np.array(img)   # shape (height, width, 3)
```

Each output pixel becomes **exactly one LEGO stud**. A 48×48 mosaic is literally
a 48×48-pixel image. `Image.LANCZOS` is a high-quality downscaling filter — it
averages many source pixels into each destination pixel (rather than nearest-
neighbor point-sampling), which is why the result looks smooth rather than
jagged.

```
   1000×1000 photo                     48×48 grid
   ┌───────────────┐                   ┌──┬──┬──┬──┐
   │  fine detail  │   LANCZOS         │  │  │  │  │   each cell = 1 stud
   │   ~1M pixels  │  ─────────▶       ├──┼──┼──┼──┤   = 1 averaged RGB
   │               │   downscale       │  │  │  │  │     triplet
   └───────────────┘                   └──┴──┴──┴──┘
```

After this stage we have `pixels`, an `(H, W, 3)` NumPy array of raw RGB
values — still *any* color, not yet LEGO colors.

---

## 3.4. Stage 2.4 — Background unification (`background.py`) — *the shadow fix*

**The problem.** A photo's backdrop is rarely one flat color — uneven lighting
leaves a shadow or vignette on the wall. The eye reads "one grey wall," but the
LEGO palette has only a few discrete greys and color-matching is a *hard
threshold*. Where the lighting crosses the midpoint between two palette greys, the
backdrop snaps — the lit part to one grey, the shadowed part to a darker grey —
with a hard false seam (a phantom "shadow color"):

```
  ORIGINAL wall (uneven lighting)            NAIVE NEAREST-COLOR SNAP
  dark ░▒▒▓▓▓ ─────────► light               ███▓▓▓░░░░░░░░░░░
       one wall, shaded                      │  └─ hard false seam
```

**Two approaches that DON'T work** (both tried and rejected against a real photo —
see the dead-ends note below):
- *Mean-shift alone* (Stage 2.5): a real shadow is a large, coherent, distinctly
  darker region, so it forms its own mode and survives. The two greys are ~95
  apart in RGB — too far to bridge without merging genuine colors.
- *Flat-field illumination correction*: dividing out the low-frequency lighting
  can't tell "dark because shadowed" from "dark because the object is black", so
  a large dark subject (hat/hoodie) creates a bright **halo** and the backdrop
  gets blotchier, not cleaner.

**The fix that works — treat the whole backdrop as ONE region.** Flood-fill
inward from the image borders and repaint everything it reaches with a single
color. Two properties make this robust:
1. **Floating-range fill** compares each candidate to its already-filled
   *neighbor*, so a gentle shadow gradient is walked end-to-end, but a sharp
   subject edge stops it.
2. A **saturation/value barrier** pre-blocks the fill from entering colorful
   (skin, hair) or dark (hoodie) pixels — so it stays inside the neutral wall and
   never leaks into the subject.

```python
barrier = (saturation > SAT_BARRIER) | (value < VAL_BARRIER)   # subject = no-go
mask[barrier] = 1                                              # blocks the fill
for seed in border_points:                                    # flood from edges
    cv2.floodFill(img, mask, seed, 0, (TOL,)*3, (TOL,)*3, FLOATING_RANGE|MASK_ONLY)
img[background_mask] = median(img[background_mask])           # repaint one color
```

| Constant | Meaning | Default |
|----------|---------|---------|
| `FLOOD_TOLERANCE` | per-step color tolerance (floating range) | 14 |
| `SAT_BARRIER` | HSV saturation above this = subject, blocks the fill | 60 |
| `VAL_BARRIER` | HSV value below this = dark object, blocks the fill | 60 |
| `MIN_BG_FRACTION` | if less than this is found to be backdrop, do nothing | 0.05 |

> ✅ **Verified on a real photo** (black beret, black hoodie, grey studio wall):
> the shadow wedge vanished, the backdrop became a single uniform grey, and the
> subject — including the true-black hat/hoodie — was untouched.
>
> ⚠️ **Limitations.** This assumes the backdrop is *neutral* (low-saturation) and
> *border-connected*. On a colorful or full-bleed background the barriers block
> the fill, too little background is found, and it safely does nothing. A
> colorful-wall shadow would not be fixed by this step.

---

## 3.5. Stage 2.5 — Region flattening (`filters.py`)

Mean-shift collapses fine noise and gentle gradients into flat color blocks while
keeping strong edges (face, hat, glasses) crisp — so the palette match produces
coherent stud blocks instead of speckle. It is the **single "quantize prep" step**
and runs for *every* profile (after the backdrop is unified, for studio portraits).

**The filter.** An **edge-preserving mean-shift filter**
(`cv2.pyrMeanShiftFiltering`) clusters spatially-near, color-similar pixels into
their shared mean.

```python
def mean_shift(arr, sp=19, sr=30):          # sp = spatial radius, sr = color radius
    bgr  = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    flat = cv2.pyrMeanShiftFiltering(bgr, sp=sp, sr=sr)
    return cv2.cvtColor(flat, cv2.COLOR_BGR2RGB)
```

`sr` is the main knob — bigger = more merging. It is now **one fixed, moderate
value** (`sr=30`) for every profile, applied at the fixed working resolution
(`WORK_SIZE`, 512 px). Previously `sr` scaled with busyness and the work image
scaled with the stud grid, so a 48-stud request got flattened twice as hard as a
96-stud one — a big source of the low-res regression.

> ⚠️ **Watch `sr`.** Too large and genuinely-different colors bleed together
> (e.g. a dark hat merging into a dark hoodie).

---

## 4. Stage 3 — Color matching (`color_palette.py`)

The palette (`data/lego_colors.json`, **40 real LEGO colors**) is loaded once at
startup. Each color has an `id`, a `name`, an `rgb`, and a `bricklink_id`.

The job of this stage: for every pixel, find the **closest LEGO color**.

### Why not just compare RGB numbers?

RGB distance does not match how humans perceive color difference. Two colors can
be close in RGB but look very different (and vice versa). So we convert to the
**CIE Lab** color space and use the **CIE 2000 (ΔE₀₀)** difference formula, which
is designed to model perceptual distance.

```
  pixel RGB          convert             compare against all 40
  [130, 200, 90]  ──────────────▶  Lab  ──────────────────────▶  ΔE00 distances
                  sRGB→XYZ→Lab           CIE2000                  ┌──────────────┐
                                                                  │ White : 61.2 │
                                                                  │ Green : 12.4 │◀─ min
                                                                  │ Lime  : 18.7 │
                                                                  │  ...  :  ... │
                                                                  └──────────────┘
                                                                        │
                                                                        ▼
                                                                  pick color id
```

### What the code actually does

`match_image(pixels)` is **fully vectorized** — one broadcast ΔE00 call scores
every pixel against all 40 colors at once, then `argmin` picks the nearest:

```python
distances = delta_E(flat_lab[:, None, :], lab_array[None, :, :], method="CIE 2000")
distances += chroma_bias * relu(palette_chroma - source_chroma)   # see below
nearest   = np.argmin(distances, axis=1)
```

This replaced a per-pixel Python loop (the old #1 hotspot) — a 96×96 match went
from several seconds to **~0.2 s**.

**Chroma bias — avoiding false vivid blobs.** A faintly-tinted grey (a night
stadium wall, a shadow) can be perceptually *closest* to a saturated palette color
like Medium Lavender, and snap to a jarring purple blob. The `chroma_bias` term
(`CHROMA_BIAS = 0.25`) adds a penalty for choosing a palette color **more saturated
than the source pixel**, so near-neutral pixels stay neutral. Genuinely colorful
pixels are unaffected (their `palette_chroma − source_chroma` is ≤ 0). This removes
the messi purple artifacts.

> ⚠️ **Keep it small.** At `0.6` this over-fired at low stud counts: downsampling
> to 48 studs averages colorful detail into soft, desaturated pixels, and a strong
> bias shoved those (e.g. pink flowers blended with foliage) all the way to grey —
> collapsing the whole wedding scene into grey mush. `0.25` still neutralizes
> faint-tinted greys while letting soft pinks/greens stay colorful.

Output: `color_grid`, an `(H, W)` array where every cell is a LEGO color ID.

```
  Color-ID grid (a 6×6 corner shown)
  ┌──┬──┬──┬──┬──┬──┐
  │ 5│ 5│ 5│12│12│12│    5 = e.g. "Red"
  │ 5│ 5│12│12│12│ 7│   12 = e.g. "Blue"
  │ 5│12│12│12│ 7│ 7│    7 = e.g. "Green"
  │12│12│12│ 7│ 7│ 7│
  │12│12│ 7│ 7│ 7│ 7│
  │12│ 7│ 7│ 7│ 7│ 7│
  └──┴──┴──┴──┴──┴──┘
```

---

## 4.5. Stage 3.5 — Speckle cleanup (`grid_cleanup.py`)

Even after flattening, color-matching can leave stray studs. `clean_grid` does a
**single pass** over the color-ID grid that snaps a stud to its dominant neighbor
color when **either** of two rules fires:

```
  before            after (isolated 7 snapped to 5)
  ┌──┬──┬──┐        ┌──┬──┬──┐
  │ 5│ 5│ 5│        │ 5│ 5│ 5│
  │ 5│ 7│ 5│  ───▶  │ 5│ 5│ 5│      the lone 7 had 0 same-color
  │ 5│ 5│ 5│        │ 5│ 5│ 5│      neighbors → replaced
  └──┴──┴──┘        └──┴──┴──┘
```

1. **Isolated speckle** — fewer than `MIN_SAME_NEIGHBORS` (default 1, i.e. *zero*)
   neighbors share its color. Tuned deliberately: at threshold 2, 1-stud-tall
   features (glasses frames, lips) got erased; at 1 they survive while scattered
   flecks are still removed.
2. **Perceptual outlier** — the stud is weakly-supported (≤ 2 same-color neighbors)
   **and** far in color (ΔE > 25) from its dominant neighbor. This catches a lone
   *wrong* fleck (a red stud on a cheek) that rule 1 keeps because it isn't fully
   isolated, while leaving genuine small features (close in color to their
   surroundings) alone. It reuses the palette's precomputed pairwise ΔE matrix, so
   each check is an O(1) lookup.

(Previously these were two separate passes — `despeckle` + `remove_color_outliers`
— now folded into one `clean_grid` pass.)

---

## 5. Stage 4 — Brick fitting (`brick_fitter.py`)

We now have a grid of colors, but real LEGO sets don't use 9,216 separate 1×1
tiles — they use larger tiles/plates where a region shares one color. This stage
**greedily merges same-color cells into the largest available brick**.

### The brick catalog (`data/lego_parts.json`)

14 parts, each with a `width`, `height`, and a `weight` (how often it should be
picked among same-size options):

```
  Tiles:   1x1  1x2  1x3  1x4  2x2  2x3          Plates:  1x1 1x2 1x3 1x4 2x2 2x3 2x4
  Round:   1x1
```

Parts are split into **large** (`area > 1`) and **small** (`area == 1`), and the
large ones are grouped into **tiers by area**, sorted largest-first:

```
  tier area 8  →  2x4 plate
  tier area 6  →  2x3 tile, 2x3 plate
  tier area 4  →  2x2 tile, 2x2 plate, 1x4 tile, 1x4 plate
  tier area 3  →  1x3 tile, 1x3 plate
  tier area 2  →  1x2 tile, 1x2 plate
  (area 1 fallback) → 1x1 tile/plate/round
```

Within a tier, a part's `weight` is applied by **duplicating it in the candidate
list** (`[p] * p["weight"]`), so heavier parts are more likely to be chosen when
the list is shuffled.

### The greedy scan

The grid is walked **top-to-bottom, left-to-right**. At the first uncovered cell,
it tries to place the biggest brick that fits:

```
  For each uncovered cell (r, c):
    color = grid[r][c]
    for tier in [largest → smallest]:          # 8, 6, 4, 3, 2
        shuffle the tier's weighted candidates
        for part in tier:
            for each orientation (and its 90° rotation):
                does the brick fit in-bounds?
                is every cell under it uncovered?
                is every cell under it the SAME color?
                ── if yes ──▶ place it, mark those cells covered, STOP
    if nothing fit ──▶ place a random 1×1 (last resort)
```

Visually, placing bricks over that 6×6 corner might yield:

```
  Color grid                    One possible brick tiling
  ┌──┬──┬──┬──┬──┬──┐           ┌────────┬────────┐
  │ 5│ 5│ 5│12│12│12│           │ 1x3 (5)│ 1x3(12)│   ← two 1×3 tiles
  │ 5│ 5│12│12│12│ 7│           ├─────┬──┴──┐  ┌──┼─┐
  │ 5│12│12│12│ 7│ 7│           │2x1  │ 2x2 │  │  │ │   ← a 1×2, a 2×2,
  │12│12│12│ 7│ 7│ 7│    ───▶   │ (5) │(12) │  │7 │ │     singles fill gaps
  │12│12│ 7│ 7│ 7│ 7│           ├──┬──┴─────┴──┴──┤ │
  │12│ 7│ 7│ 7│ 7│ 7│           │  │   2x2 (7)   ...│
  └──┴──┴──┴──┴──┴──┘           └──┴───────────────┘
```

### The two outputs

**`placements`** — one entry per physical brick, with its top-left `row`/`col`,
`brick_width`/`brick_height`, `part_id`, and `color_id`. This is the
"build list."

**`parts_list`** (`build_brick_parts_list`) — the placements aggregated by
`(part_id, color_id)` into quantities, sorted most-used first. This is the
"shopping list":

```
  part_name   color    qty
  ─────────────────────────
  2x2 Tile    Blue      42
  1x2 Plate   Red       31
  1x1 Tile    Green     18
  ...
```

> ⚠️ **This stage is random and non-deterministic** (`random.shuffle` /
> `random.choice` with no seed). The same image processed twice produces
> different brick layouts. It is also **greedy, not optimal** — it never
> backtracks, so it can strand awkward single cells that a smarter tiler would
> avoid.

---

## 6. Stage 5 — Bagging & the PDF

### 6a. Bag organization (`bag_organizer.py`)

Large mosaics are split into sections so a builder can tackle them one bag at a
time. The grid is subdivided based on size (capped at `MAX_BAGS = 6`):

```
   ≤ 24×24        ≤ 48×48            larger
   ┌───────┐      ┌───┬───┐      ┌────┬────┬────┐
   │       │      │ 1 │ 2 │      │ 1  │ 2  │ 3  │   up to 3 cols × 2 rows
   │   1   │      ├───┼───┤      ├────┼────┼────┤
   │       │      │ 3 │ 4 │      │ 4  │ 5  │ 6  │
   └───────┘      └───┴───┘      └────┴────┴────┘
    1 bag           4 bags              6 bags
```

Each brick is assigned to a bag by its **top-left corner** (`row`/`col`). Every
bag gets its own `parts` list, `placements`, `total_parts`, and section `grid`.

> ⚠️ **Edge case:** a brick straddling a section boundary is assigned entirely to
> the bag containing its top-left corner, even though it physically extends into
> the neighboring section.

### 6b. PDF generation (`pdf_generator.py`)

Uses ReportLab to build an A4 instruction booklet:

```
  ┌─Cover──────┐ ┌─Parts──────┐ ┌─Bag N──────┐ ┌─Bag N ─────┐ ┌─Final──────┐
  │ title      │ │ complete   │ │ parts      │ │ build      │ │ completed  │
  │ WxH, pcs,  │ │ parts      │ │ table for  │ │ steps grid │ │ mosaic     │
  │ bags       │ │ table      │ │ this bag   │ │ w/ symbols │ │ preview    │
  │ [mosaic]   │ │            │ │            │ │ + legend   │ │            │
  └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘
     page 1         page 2       ── two pages per bag ──          last page
```

Key details:
- **Color→symbol map:** every color id is assigned a letter/symbol
  (`A, B, C, …`) so builders can read a bag grid even in grayscale.
- **Brick rendering** (`_draw_mosaic_with_bricks`) draws each placement as a
  filled, outlined rectangle at `bw×bh` cell size. Note the Y-flip:
  `cy = y + (grid_rows - 1 - row - (bh-1)) * cell` because PDF coordinates start
  at the bottom-left, but our grid is indexed from the top.
- **Symbol contrast:** text is black or white depending on the brick's perceived
  brightness (`0.299R + 0.587G + 0.114B`).

---

## 7. Where we can improve

Ordered roughly by impact-to-effort.

### ✅ Performance — vectorized color matching *(done)*
`match_image` now scores the whole grid against all colors in one broadcast
`delta_E` call + `argmin` (see [Stage 3](#4-stage-3--color-matching-color_palettepy)).
A 96×96 match dropped from several seconds to ~0.2 s; mean-shift is now the main
cost. The whole pipeline runs a 96² in ~2–5 s depending on profile.

### 🟡 Content-adaptive follow-ups (from the messi / ala test images)
- **Smart crop** — a busy full-body scene (wedding) is still hurt by the
  center-crop cutting the subject; saliency/face-aware crop is the next lever
  (deliberately deferred).
- **Palette gaps** — very dark or unusual tones still band a little; a curated or
  expanded neutral/dark palette would help the hardest images beyond what the
  chroma bias fixes.

### 🟠 Determinism — seed or remove randomness
`brick_fitter` uses unseeded `random`, so results are irreproducible (hard to
debug, hard to test, and a user re-running gets a different mosaic). Options:
accept a `seed` parameter, or replace random tie-breaking with a deterministic
rule.

### 🟠 Brick fitting quality — greedy → smarter
The current tiler is greedy with no backtracking and can leave stranded 1×1s.
Improvements worth exploring:
- Prefer orientations/positions that minimize leftover single cells.
- A second "merge pass" that combines adjacent same-color 1×1s the first pass
  missed.
- Optionally cap piece counts or bias toward parts the user actually owns.

### 🟡 Persistence — `jobs` dict is in-memory
Job results (including PDFs) live in a module-level dict. They vanish on restart
and leak memory forever (nothing is ever evicted). For anything beyond a demo,
move to Redis / a DB / temp files with a TTL, and add cleanup.

### ✅ Shadow banding — *implemented (backdrop unify + mean-shift + despeckle)*
A shadow splitting the backdrop into two greys with a hard seam is now handled by
three stages: **2.4** background unification (repaints the backdrop one color —
the primary fix), **2.5** mean-shift (flattens the subject), **3.5** despeckle
(stray studs). Verified on a real photo (see `results/ktyb_before.png` vs
`results/ktyb_after.png`).

**Dead-ends (tried, rejected — don't re-attempt without new ideas):**
- *Raising the mean-shift color radius* — doesn't merge a coherent shadow (the
  two greys are too far apart in color).
- *Flat-field illumination correction* — creates a bright halo around large dark
  subjects; made the real photo worse, not better.

**Remaining follow-ups:**
- Background unification only helps a *neutral, border-connected* backdrop. A
  colorful-wall shadow needs a different approach (e.g. GrabCut / ML matting to
  segment foreground).
- Consider **Floyd–Steinberg dithering** as an *alternative* philosophy for the
  subject — diffuses quantization error into a gradual blend (better for
  skies/skin, but adds speckle texture).

### 🟡 Bag boundary bricks
Bricks are bagged by their top-left corner and can straddle a section boundary.
Either forbid cross-boundary placements during brick fitting for large mosaics,
or make the bagging explicitly aware of overlap.

### 🟢 Robustness & API
- `process_image` doesn't guard against `Image.open` failures on corrupt files —
  wrap and return a clean 400.
- Consider making `/process` return the `job_id` immediately and doing heavy work
  in a background task for large mosaics (avoids long request timeouts).
- The palette and parts JSON are re-instantiated in three modules
  (`processor`, `bag_organizer`, `pdf_generator` each build a `LegoPalette`) —
  could be a single shared instance.

---

## 8. Quick reference — data shapes

```
image_bytes        : bytes
pixels             : np.ndarray (H, W, 3)  uint8       — raw RGB after resize
color_grid / grid  : list[list[int]] (H×W)             — LEGO color IDs
placements         : list[{ part_id, part_name, color_id,
                            row, col, brick_width, brick_height }]
parts_list         : list[{ part_id, part_name, color_id, color_name,
                            rgb, quantity }]              — sorted desc by qty
bags               : list[{ bag_number, section, parts,
                            placements, total_parts, grid }]
pdf                : bytes (A4 booklet)
```
