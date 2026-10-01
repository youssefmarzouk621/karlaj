# The mosaic pipeline

How an uploaded photo becomes a buildable LEGO mosaic: what each stage does,
what it deliberately does *not* do, and which knobs change the result.

The pipeline lives in [`mosaic-generator/`](../mosaic-generator/) — a FastAPI
service on port 8002. It began as a faithful port of
[brickmos](https://github.com/merschformann/brickmos) (33-color BrickLink
palette, Euclidean-RGB nearest color, linear downsample) with a vectorized
matcher and a brick-fitting stage on top. That path still exists as the `legacy`
profile.

The default `perceptual` profile adds attention detection, region-aware
downsampling and CIELAB matching, because the original approach falls apart on a
supplier palette with a gamut hole — see [Palette requirements](#palette-requirements),
which is the single most important thing on this page.

Budget roughly **0.9–3 s** per generation (the upper end is a 17MP phone photo;
detection is ~60% of it), against a few milliseconds for `legacy`. That is the
deliberate trade: `legacy` was fast and, on the current palette, wrong.

## End-to-end flow

```
browser (create flow)
  │  multipart: image + width + height
  ▼
frontend/src/app/api/convert/route.ts        ← Next.js route, picks the service
  │                                            via MOSAIC_SERVICE (lib/mosaicService.ts)
  ▼
POST :8002/process                           ← mosaic-generator/main.py
  │
  ├─ 1. load config from MySQL ................ db.py         palette + parts
  ├─ 2. decode → crop → cap resolution ........ mosaic.py     → working image
  ├─ 3. find silhouette + text ................ attention.py  → priority map
  ├─ 4. downsample by region → quantize ....... preprocess.py → index grid
  │                                             palette.py
  ├─ 5. despeckle + fit plates ................ bricks.py     → placements
  ├─ 6. aggregate parts list .................. bricks.py     → BOM
  ├─ 7. split into bags ....................... bags.py       → build sections
  └─ 8. render PDF ............................ pdf.py        → cached in memory
  │
  ▼  JSON: { job_id, width, height, grid, placements, parts_list, total_parts, bags }
frontend route persists an Artwork row + pre-renders preview images
  │
  ▼
result page / cart
```

The priority map from stage 3 feeds **both** stage 4 and stage 5, which is the
key structural point: it decides where the image is sampled crisply (what the
customer sees) *and* where the build uses small plates (what the builder
handles).

## Stage by stage

### 1. Request validation — [`main.py`](../mosaic-generator/main.py)

`POST /process` takes multipart `image` plus form fields `width` and `height`
(in **studs**). Rejected with `400` if: either dimension is outside **16–96**
(`MIN_SIZE`/`MAX_SIZE`), the content type isn't `image/*`, or the upload exceeds
**20 MB**.

### 1b. Load the active configuration — [`db.py`](../mosaic-generator/db.py)

Read fresh on **every** request, so an admin's dashboard edit takes effect on the
next generation with no restart:

- `load_palette_colors()` — colors of the single `enabled` palette, ordered by
  `sort_order`.
- `load_parts()` — every `enabled` **brick** (`kind = 'BRICK'`) from `parts`,
  ordered by `sort_order`. The 1×1 row's `variable` column carries the max-1×1 cap.
- `load_base()` — the first `enabled` **base** (`kind = 'BASE'`, e.g. the 16×16
  Technic plate 65803). `None` means no base: no seam rule, free-form bags, and
  `base_layout: null` in the response — the pre-base behavior.

Both talk to the shared MySQL database over `DATABASE_URL` (raw PyMySQL — the
table/column names are the contract with
[`database/prisma/schema.prisma`](../database/prisma/schema.prisma)). **Both fail
soft**: any connection or query error, or an empty result, returns `None` and the
service falls back to the built-in `BRICK_COLORS` (33 BrickLink colors) and
`DEFAULT_PARTS` (the 7 standard plates). A generation therefore never fails
because the database is down — it silently produces the default-palette result.

### 2. Decode, crop, cap resolution — [`mosaic.py`](../mosaic-generator/mosaic.py)

`prepare_source` decodes, **center-crops** to the target aspect ratio (so the
picture isn't stretched into a non-square stud grid), then **caps the longest
side** at `WORK_MAX` (1024px, or 10 source pixels per stud, whichever is
larger).

That cap is not cosmetic. Filtering a 17MP phone photo at full resolution cost
**7 seconds** in a service that advertises milliseconds, and nothing downstream
can use the detail: even at the 96-stud maximum, 1024px leaves ~10 source pixels
per stud, more than an area average needs. Crop first, scale second, so framing
is unchanged.

Everything downstream — quantization *and* detection — works from this one
image.

### 3. Silhouette and text — [`attention.py`](../mosaic-generator/attention.py)

Produces a per-stud priority map: `SILHOUETTE (2)` > `TEXT (1)` > `BACKGROUND
(0)`, silhouette winning any overlap.

- **Silhouette** — spectral-residual saliency (Hou & Zhang, ~15 lines of numpy,
  no opencv-contrib dependency) seeds a GrabCut, which turns a blurry saliency
  blob into a mask whose edges follow the subject. Falls back to thresholded
  saliency when GrabCut returns something degenerate (it can, on flat images).
- **Text** — MSER character candidates, filtered by aspect, fill, stroke-width
  *variation* and stroke *thickness*, then grouped into baseline-aligned runs
  by union-find and ranked by `count × mean height`, accepted until an area
  budget (12% of frame) is spent.

Two of those filters exist for specific observed failures. Stroke **thickness**
rejects filled blobs: without it, the two faces in a wedding photo are similarly
sized, share a baseline, and get reported as a line of text. The **area budget**
handles the rest: a busy album cover had ~50% of its frame flagged, because palm
fronds and flame motifs genuinely *are* thin uniform strokes and pass every
per-character test. Ranking whole groups and cutting off at a budget keeps the
headline and drops the foliage.

This is classic CV, so it misses stylised type rather than inventing it — the
deliberate direction, since a false positive spends the 1×1 budget on nothing.

Detection runs on the source image, never the stud grid: at 48×48 there is
nothing left to detect.

### 4. Downsample by region → index grid — [`preprocess.py`](../mosaic-generator/preprocess.py)

Two profiles. `legacy` is brickmos's original path, kept intact and reachable:
`INTER_LINEAR` resize, Euclidean-RGB nearest color, no conditioning. `perceptual`
is the default:

**Region-aware downsampling.** Smoothing is what stops a flat field speckling
across near-equidistant bricks, and it is also what destroys thin strokes — so
each region gets what suits it:

| region | treatment | why |
|---|---|---|
| background | bilateral → area-average | kills speckle, keeps edges |
| silhouette | area-average only | sharpening a face amplifies skin texture and JPEG noise into a rash of stray studs — measurably worse |
| text | unsharp mask → area-average | pushes edge pixels back to their extremes so a stroke lands on the letter's color, not a midtone between |

**Perceptual matching** ([`palette.py`](../mosaic-generator/palette.py)): dE76 in
CIELAB, plus a penalty that makes near-neutral source pixels avoid chromatic
bricks. Lightness is deliberately *not* up-weighted — that protects whites but
sends a flat pink field to tan, trading a tone error for a hue error, and over a
large flat area the hue error is far more objectionable.

**Tone compression**, only ever *downward*: when the palette's lightness range
is narrower than the image's, the image is squeezed to fit. An earlier version
also expanded, which on a high-key wedding photo was a ~2.3× gain that amplified
JPEG noise and a faint color cast into blue and green bricks — worse than doing
nothing.

> **The original "no preprocessing" stance was right, conditionally.** brickmos's
> rich shading does come from keeping the natural variation of a linearly
> downsampled image — *as long as the palette covers the image's colors.* It
> breaks down on a palette with a gamut hole. Don't reintroduce global filters
> without comparing renders; use `tests_result/compare.py`.

Output: an `(height, width)` array of **palette indices**.

### 5. Index grid → brick placements — [`bricks.py`](../mosaic-generator/bricks.py)

Rules that turn a field of studs into real plates without touching the colors.

**a. Light cleanup (`_despeckle_isolated`).** Only *fully isolated* studs — a
lone color with no same-color neighbor among its 8 — are snapped to their
dominant neighbor. Those are salt-and-pepper artifacts, not shading; removing
them both deletes unmergeable 1×1s and lets the cell join a neighbour's brick.
Everything else keeps the exact palette match from stage 4.

Studs on a subject's **outline** and inside **text** are exempt: there a lone
stud is usually signal (a letter stem, a contour turning a corner). The exemption
is limited to the outline band on purpose — protecting a subject's whole
interior preserves skin texture, which held the 1×1 share at ~49%, forced the cap
search (below) down to a tiny-plate catalog, and doubled the part count.

**b. Largest-brick-under-cap (`fit_bricks`).** Tiling is a greedy top-left scan:
at each uncovered stud, place the largest brick from the catalog that fits in
bounds, is uncovered, and is a single color.

The catalog itself is chosen by search. `_tiers()` builds a list of catalogs from
the enabled parts (both rotations of each shape, largest area first): tier 0 has
every shape, each later tier drops the current largest shape, and 1×1 is always
retained so any leftover cell is coverable. `fit_bricks` then tiles with each
tier biggest-first and returns the **first result whose 1×1 share is at or under
the cap**.

The direction of that trade is the non-obvious part: bigger bricks mean *fewer
total parts*, which **raises** the 1×1 fraction. So a busy image that blows the
cap falls back to a smaller-plate catalog — more parts overall, which dilutes the
unavoidable isolated 1×1s back under the limit. If no tier makes the cap (rare),
the smallest-plate tier's result is used as best effort.

**d. Base seams.** When a base is configured, no plate may straddle the seam
between two bases (`cell` in `_greedy_fit`), so each base is a self-contained
sub-build that is pinned to its neighbours afterwards. Measured on four sample
photos at 48×48 with the 7 square plates: part count **−2% to +10%**. With
round 1×1 only it changes nothing.

Edge cases: if 1×1 is the only enabled shape, the artwork is all 1×1 and the cap
is ignored — there's nothing to cap against. If 1×1 is *disabled*, it's added
back internally anyway to guarantee coverage.

`fit_bricks` returns `(placements, grid)` — the despeckled grid, so the `grid`
field and the `placements` field of the response always agree.

Measured on the sample photos: 1×1 lands at **20–34%** with a healthy mix of
1×2/1×3/1×4/2×2/2×3/2×4, colors identical to the 1×1-only output.

**c. Where the budget is spent.** The cap is a budget, and left to the greedy
scan it lands wherever gaps happen to fall — measured at **73–77% in the
background**, buying nothing a 2×4 plate wouldn't. With a priority map, the
subject's outline and any text are built from plates of at most 2 studs, and no
plate may straddle the boundary (a 2×4 spanning a subject's edge drags four
background studs into the subject's color). Detail plans are tried in order and
the first affordable one wins:

1. silhouette + text
2. silhouette only — **text gives up its 1×1s first**
3. none

That ordering is the product rule: when the budget can't cover both, the subject
keeps its detail, because a recognisable face matters more than crisp lettering
at viewing distance.

> **Caveat worth knowing.** This stage changes the *physical build*, not the
> picture — stud colors are fixed in stage 4, before tiling runs. Unbounded, it
> doubled the part count on a busy portrait (782 → 1394) for zero visible change,
> so `MAX_PART_INFLATION` (25%) caps what it may cost. Detail tiling is for the
> person assembling the set; the visible clarity win comes from stage 4.

### 6. Parts list — [`bricks.py`](../mosaic-generator/bricks.py)

`build_parts_list` aggregates placements by `(part_id, color_id)` into a
BrickLink-style BOM, sorted by quantity descending.

### 7. Bags — [`bags.py`](../mosaic-generator/bags.py)

Real sets don't dump every piece into one sack; each numbered bag builds one
manageable chunk. Bag count is `ceil(total_parts / TARGET_PARTS_PER_BAG)` (70),
clamped to 1–18. `_grid_shape` then picks the `n_rows × n_cols` split whose
sections come out as square as the mosaic's aspect ratio allows, lightly
penalising layouts that overshoot the target count. Sections are numbered row by
row, so they build top-to-bottom, left-to-right.

A brick is assigned to the section containing its **top-left stud**, so a plate
straddling a boundary ships in the earlier bag — bag `total_parts` values are
therefore only approximately equal.

**With a base, each bag is exactly one base** (numbered row by row, matching
the numbers drawn on the PDF preview), and the bag-count target/cap don't apply:
the base grid fixes the count. Plates never cross a seam, so a bag holds
exactly its base's parts. A 48×48 all-1×1 mosaic is 9 bags of 256.

The base grid itself comes from [`base.py`](../mosaic-generator/base.py):
`ceil(width / base_width) × ceil(height / base_height)` bases, plus
`PINS_PER_SEAM` (2 — an assumption, confirm on a physical base) Technic pins
(2780) per shared edge. A size that isn't a multiple of the base is covered by
rounding up, `exact: false`, and the uncovered studs stay bare.

### 8. PDF — [`pdf.py`](../mosaic-generator/pdf.py)

Page 1 is a scaled preview drawn placement by placement (each at its real brick
size, so larger plates show as single tiles), with base seams and base/bag
numbers overlaid when a base is configured; page 2+ is the bases + pins table
(when there is a base) and then the parts table. Bases and pins are *not* in
`parts_list` — it stays an aggregate of placements. Built
eagerly during `/process` and held in the in-process `jobs` dict, then served by
`GET /pdf/{job_id}`.

**`jobs` is an in-memory dict** — restarting the service drops every stored PDF
and `GET /pdf/{job_id}` starts returning 404 for older jobs. The mosaic data
itself survives, because the frontend persists it (below).

### 9. Persistence — [`frontend/src/app/api/convert/route.ts`](../frontend/src/app/api/convert/route.ts)

The generator is stateless beyond that dict; durability is the Next.js route's
job. After a successful `/process` it links the result to the matching catalog
`MosaicSize` (when the dimensions match one) and to the currently enabled
`Palette`, writes an `Artwork` row, and pre-renders the high-fidelity and
cart-sized preview images. Image rendering is best-effort — a failure there is
logged, not fatal, and display falls back to a live client-side canvas draw.

## Response shape

```jsonc
{
  "job_id": "uuid",
  "width": 48, "height": 48,
  "grid": [[1, 86, ...], ...],   // (height × width) color ids — see the caveat below
  "placements": [                // one entry per physical brick
    { "part_id": "3023", "part_name": "1x2 Plate", "color_id": 86,
      "color_name": "LightBluishGray", "rgb": [175, 181, 199],
      "row": 0, "col": 4, "brick_width": 2, "brick_height": 1 }
  ],
  "parts_list": [ { "part_id": "3023", "color_id": 86, "quantity": 137, ... } ],
  "total_parts": 1129,           // == placements.length, not the stud count
  "bags": [ { "bag_number": 1, "section": {...}, "parts": [...], "total_parts": 68 } ],
  "base_layout": {               // null when no base is enabled
    "part_id": "65803", "name": "16x16 Technic Base", "base_width": 16, "base_height": 16,
    "rows": 3, "cols": 3, "count": 9, "exact": true,
    "pins": { "part_id": "2780", "name": "Technic Pin with Friction", "quantity": 24 }
  },
  "preprocessing": { "profile": "mosaic-generator", "steps": [], "metrics": {} }
}
```

`total_parts` counts **bricks, not studs** — a 48×48 mosaic is 2304 studs but far
fewer parts once plates are merged.

**`color_id` means different things depending on the config source.** With the
built-in palette it's the real BrickLink color id (White = 1, Black = 11). With a
DB palette, `db.load_palette_colors` assigns `color_id = list index` (0…N-1) so
the frontend's numeric color map keeps working. Don't treat a `color_id` from one
source as meaningful in the other. Likewise `part_id` on a placement always comes
from the parts table/`DEFAULT_PARTS`, never from the palette.

The response mirrors `backend/` and `brickmos`, which is what lets
`MOSAIC_SERVICE` swap between the three services with no frontend change.

## Palette requirements

**A palette must contain a white, a black, and at least one light near-neutral.**
This is a hard requirement of the pipeline, not a preference, and it is worth
more than every algorithm on this page combined.

The supplier range ("Alibaba Supplier (PX)", 84 colors) has none of them. Its
lightness runs **L\* 16–84** where photographs run 0–100, and every light color
is saturated — the lightest near-neutral is a warm beige at chroma 22. Pure white
sits **117 RGB units** from the nearest brick. The consequences were not subtle:

| image | before | cause |
|---|---|---|
| white studio wedding photo | **79.8% lavender** | at 117 units out, a lavender beat a beige by a hair, and pixel noise flipped between them |
| flat pink poster | background **tan**, white title **invisible** | title and background both landed in the same beige family |

The import had already flagged this and it was missed —
`mosaic-generator/palette_to_seller.csv` contains
`White,1,#FFFFFF,A08,#E6BEA1,117.0,WEAK-verify`.

Four neutrals (white, light gray, mid gray, black) are therefore seeded into the
palette and marked **`external`** in the `colors` table, because the supplier does
not carry them and they must be sourced separately. The dashboard's Palettes page
shows the count and outlines those swatches. `database/seed/seed.mjs`
(`ensureExternalNeutrals`) adds any that are missing, idempotently.

Adding them alone — no code changes — took the wedding photo from unrecognisable
to clean, and cut its mean colour error from **dE 29.6 to 6.1**. If a future
palette is swapped in, check its neutral coverage first.

## Where the knobs live

| Knob | Effect | Where |
|---|---|---|
| Enabled palette + its colors | The color vocabulary of every mosaic | Dashboard → Palettes (`palettes`/`colors` tables) |
| Enabled parts | Which plate shapes the tiler may use | Dashboard → Parts → Bricks (`parts.enabled`) |
| Enabled base | Seam rule, bags per base, base/pin counts | Dashboard → Parts → Bases (`kind = 'BASE'`) |
| `PINS_PER_SEAM` | Pins per shared base edge (2) | [`base.py`](../mosaic-generator/base.py) |
| 1×1 cap | Max share of the build that may be 1×1 | `parts.variable` on the 1×1 row; falls back to `MAX_1X1_FRACTION = 0.35` |
| `TARGET_PARTS_PER_BAG`, `MAX_BAGS` | Bag count and size | [`bags.py`](../mosaic-generator/bags.py) |
| `MIN_SIZE` / `MAX_SIZE` | Accepted stud dimensions | [`main.py`](../mosaic-generator/main.py) |
| `MOSAIC_SERVICE` | Which generator the frontend calls | `frontend/.env` (`mosaic-generator` → port 8002) |
| `DEFAULT_PROFILE` | `perceptual` (default) vs `legacy` | [`preprocess.py`](../mosaic-generator/preprocess.py) |
| `MAX_PART_INFLATION` | How much detail tiling may raise the part count (0.25) | [`bricks.py`](../mosaic-generator/bricks.py) |
| `MAX_DETAIL_AREA` | Biggest plate allowed on a subject outline (2 studs) | [`bricks.py`](../mosaic-generator/bricks.py) |
| `TEXT_AREA_BUDGET` | Max share of frame the text detector may claim (0.12) | [`attention.py`](../mosaic-generator/attention.py) |
| `WORK_MAX` | Working resolution cap — the main latency lever | [`mosaic.py`](../mosaic-generator/mosaic.py) |

## Cost and complexity

Measured on a 17MP source at 96×96 studs: **~3.1 s** total — decode 0.66 s,
attention 1.5 s (GrabCut dominates), quantize 0.28 s, tiling 0.72 s. A normal
web-sized image is **~0.9 s**. Before the `WORK_MAX` cap this was 10.3 s, almost
all of it bilateral filtering at full sensor resolution.

Everything is vectorized except two Python loops: `_despeckle_isolated` (one pass
over the grid, 8 neighbor reads per stud) and `_greedy_fit` (one pass per catalog
tier, per detail plan). If latency needs to come down further, `SILHOUETTE_WORK`
and skipping attention for small stud grids are the levers with the best
quality-per-millisecond.

## Validating a change

Never judge a pipeline change by one image — several of the changes documented
here looked plausible and measured worse.

```bash
cd mosaic-generator
venv/bin/python tests_result/compare.py          # A/B table + contact sheets
venv/bin/python tests_result/check_attention.py  # silhouette/text mask overlays
venv/bin/python tests_result/render.py --out tests_result/scratch --tag mine --priority
```

`compare.py` scores each variant on three numbers, kept because each catches
what the others miss:

- **dE76** — mean CIELAB error per stud. "The colors are wrong."
- **SSIM** — structural similarity on lightness. Catches a mosaic with low
  average color error that has lost every edge.
- **SSIM-sub** — the same, inside the detected subject. The number the attention
  work exists to move.

Watch the part count alongside them: fidelity gains that arrive as a 2× part
count are a cost-of-goods regression, not a win.

Current state, `before` → `+attention`:

| image | dE76 | SSIM-sub | parts |
|---|---|---|---|
| 21.jpg | 25.3 → **14.5** | 0.605 → **0.791** | 603 → 781 |
| album drake.jpeg | 11.7 → **9.2** | 0.815 → **0.910** | 687 → 782 |
| wed.jpg | 29.6 → **4.8** | 0.370 → **0.900** | 495 → 623 |
| messi.jpg | 15.5 → **7.4** | 0.851 → **0.951** | 680 → 916 |
| kanye.jpeg | 17.2 → **12.8** | 0.785 → **0.880** | 686 → 1100 |

End to end through the real app (upload → generate → measure the rendered
canvas), with screenshots kept in `mosaic-generator/tests_result/e2e/`:

```bash
cd frontend && npx playwright test e2e/mosaic-quality.spec.ts
```

## Working on it

```bash
cd mosaic-generator
source venv/bin/activate
uvicorn main:app --reload --port 8002     # docs at /docs
```

Point the frontend at it with `MOSAIC_SERVICE=mosaic-generator` in
`frontend/.env`, then drive the real create flow with Playwright rather than
curling `/process` — the interesting failures are in how the grid renders, not in
the JSON. See [Validating a change](#validating-a-change) above for the harnesses.

The color quality here is the product's differentiator and it is easy to flatten
with a change that looks reasonable in isolation. Two habits worth keeping:

- Suspect the **palette** before the algorithm. The worst failure on record was a
  missing white, not a bad matcher.
- Separate *what the customer sees* (stages 2–4, the stud colors) from *what the
  builder handles* (stage 5, brick sizes). Confusing the two leads to spending a
  1×1 budget on something that cannot change the picture.
