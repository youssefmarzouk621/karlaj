# mosaic-generator

A fast FastAPI LEGO-mosaic service, inspired by
[brickmos](https://github.com/merschformann/brickmos).

## Why it exists

brickmos produces noticeably better color/shade results than the `backend/`
pipeline, because it does something simpler: it maps the linearly-downsampled
image straight onto a well-chosen **33-color BrickLink palette** with plain
Euclidean-RGB nearest-color, and does **no flattening preprocessing**. The
natural color variation of the downsampled image reads as rich shading.

This service reproduces that exactly, with one change: the nearest-color match
is **vectorized with numpy** instead of brickmos's per-pixel Python double loop,
so a mosaic generates in a few milliseconds (pixel-identical output).

## Pipeline

```
decode -> crop -> cap resolution -> detect silhouette/text
       -> downsample by region -> nearest CIELAB color
       -> black darks + ink lines -> fit plates
```

Full write-up, including why the original "no preprocessing" rule was right but
conditional, and the palette requirement that matters more than any of the code:
**[docs/pipeline.md](../docs/pipeline.md)**.

The original brickmos conversion (`INTER_LINEAR` + Euclidean RGB, no
conditioning) is still reachable as the `legacy` profile in `preprocess.py`.

## Run

```bash
cd mosaic-generator
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt   # first time only
uvicorn main:app --reload --port 8002
```

Endpoints (same shape as `backend/`, so the frontend can switch via
`PYTHON_API_URL`):

- `POST /process` — multipart `image` + form `width`/`height` (studs, 16–128),
  optional `crop_x`/`crop_y` (0–1 crop position, default centered) →
  `{ job_id, grid, placements, parts_list, total_parts, bags, ... }`
- `GET /pdf/{job_id}` — the instruction/BOM PDF, built on first request.

`/process` must stay under 5 s; per-stage times are in
`preprocessing.metrics.timings_ms`.

Before/after renders of any pipeline change (round plates on a black base, next
to the reference build): `venv/bin/python optimization/compare.py`, output in
`optimization/out/` (gitignored).

Docs: http://localhost:8002/docs

## Modules

| File | Role |
|------|------|
| `palette.py` | palette colors + RGB and CIELAB nearest-color matchers |
| `preprocess.py` | region-aware downsampling, tone compression, profiles |
| `attention.py` | silhouette (saliency + GrabCut) and text (MSER) → priority map |
| `mosaic.py` | decode / crop / resolution cap / quantize → index grid |
| `ink.py` | dark studs → black, thin dark linework → one-stud black outlines |
| `bricks.py` | grid → placements + parts list, merging same-color runs into plates |
| `bags.py` | split into build sections |
| `pdf.py` | preview + BrickLink BOM PDF |
| `db.py` | reads the enabled palette + parts from MySQL |
| `main.py` | FastAPI wiring |
| `tests_result/` | comparison harnesses and kept reference renders |

## Bricks & the 1×1 cap

`bricks.fit_bricks` merges same-color studs into LEGO plates (1×2 … 2×4) while
keeping **1×1 ≤ 35% of parts**, without changing the colors:

1. **Light cleanup** — only *fully isolated* studs (a lone color with no
   same-color neighbor) are snapped to their dominant neighbor. That's
   salt-and-pepper noise, not shading, so the brickmos-style richness is kept;
   it also removes unmergeable 1×1s.
2. **Largest-brick-under-cap** — greedily tile with the *biggest* plate catalog
   whose 1×1 share is ≤ 35%. Bigger bricks mean fewer total parts, which *raises*
   the 1×1 fraction, so a very busy image falls back to a smaller-plate catalog
   (more parts) that keeps the unavoidable isolated 1×1s under the limit.

3. **Spend the budget where it shows** — the outline of the detected subject and
   any detected text are built from plates of at most 2 studs, and no plate may
   straddle that boundary. Without this, 73–77% of 1×1s landed in the
   background. Capped at `MAX_PART_INFLATION` (+25% parts) because this changes
   the physical build, not the picture.

Measured on the sample photos: 1×1 lands at **20–34%** with a healthy mix of
1×2/1×3/1×4/2×2/2×3/2×4, colors identical to the 1×1-only output.

## Palette requirement

A palette needs a white, a black and a light near-neutral. The PX supplier range
has none, which made white photos render lavender; four neutrals are seeded and
flagged `external` in the DB. See
[docs/pipeline.md](../docs/pipeline.md#palette-requirements) — read this before
swapping palettes.

## Roadmap

- **Done:** larger bricks with the 1×1 cap; perceptual matching; silhouette/text
  attention steering both quantization and tiling.
- Possible next: bias tiling to favor 2×N over 1×N for sturdier builds; expose the
  cap / catalog as request parameters; user-constrained palette (colors you own);
  a DNN text detector if stylised type turns out to matter.
