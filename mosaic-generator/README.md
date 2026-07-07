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
decode -> center-crop to aspect ratio -> resize (INTER_LINEAR) -> nearest palette color
```

No mean-shift, tone, chroma-bias, or despeckle. That is intentional.

## Run

```bash
cd mosaic-generator
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt   # first time only
uvicorn main:app --reload --port 8002
```

Endpoints (same shape as `backend/`, so the frontend can switch via
`PYTHON_API_URL`):

- `POST /process` — multipart `image` + form `width`/`height` (studs, 16–96) →
  `{ job_id, grid, placements, parts_list, total_parts, bags, ... }`
- `GET /pdf/{job_id}` — the generated instruction/BOM PDF.

Docs: http://localhost:8002/docs

## Modules

| File | Role |
|------|------|
| `palette.py` | 33 BrickLink colors + vectorized nearest-color matcher |
| `mosaic.py` | decode / center-crop / resize / quantize → index grid |
| `bricks.py` | grid → placements + parts list, merging same-color runs into plates |
| `bags.py` | split into build sections |
| `pdf.py` | preview + BrickLink BOM PDF |
| `main.py` | FastAPI wiring |

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

Measured on the sample photos: 1×1 lands at **20–34%** with a healthy mix of
1×2/1×3/1×4/2×2/2×3/2×4, colors identical to the 1×1-only output.

## Roadmap

- **Done:** larger bricks with the 1×1 cap (above).
- Possible next: bias tiling to favor 2×N over 1×N for sturdier builds; expose the
  cap / catalog as request parameters; user-constrained palette (colors you own).
