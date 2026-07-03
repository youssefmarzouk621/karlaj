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
| 2. Pixelize | `processor.py` | image bytes | `width × height` RGB grid |
| 3. Color-match | `color_palette.py` | RGB grid | grid of LEGO color IDs |
| 4. Brick-fit | `brick_fitter.py` | color-ID grid | list of brick placements |
| 5. Bag + PDF | `bag_organizer.py`, `pdf_generator.py` | placements | bags + printable PDF |

Everything is kept **in memory**. Results are stashed in a module-level
`jobs: dict` keyed by a random UUID so the PDF can be downloaded later via
`GET /pdf/{job_id}`.

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

`match_image(pixels)`:
1. Flatten `(H, W, 3)` → `(H·W, 3)`.
2. Convert **all** pixels to Lab in one vectorized call.
3. **Loop over every pixel one at a time**, computing ΔE00 against all 40
   palette colors and taking the `argmin`.
4. Reshape the winning IDs back to `(H, W)`.

```
for i in range(flat.shape[0]):          # H·W iterations
    distances = delta_E(flat_lab[i], self.lab_array, method="CIE 2000")
    result_ids[i] = self.colors[argmin(distances)]["id"]
```

> ⚠️ **This per-pixel Python loop is the #1 performance hotspot.** A 96×96 mosaic
> is 9,216 pixels, and each iteration calls the (relatively expensive) CIE 2000
> function. See [Improvements](#7-where-we-can-improve).

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

### 🔴 Performance — vectorize color matching
`color_palette.match_image` loops over every pixel in Python. For a 96×96 mosaic
that is ~9,200 sequential `delta_E` calls. `colour.delta_E` supports
broadcasting, so the whole grid can be matched in a handful of array operations:

- Compute `flat_lab` `(N, 3)` once (already done).
- Broadcast against `lab_array` `(40, 3)` → distances `(N, 40)` in one call.
- `argmin(axis=1)` → all winning indices at once.

Expected: **10–100× faster** matching, and simpler code. This is the single
biggest win.

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

### 🟡 Color accuracy — dithering
Flat nearest-color mapping produces visible banding on gradients (skies,
skin tones). Adding **Floyd–Steinberg dithering** before/at the matching step
would diffuse quantization error and dramatically improve perceived quality on
photographic images.

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
