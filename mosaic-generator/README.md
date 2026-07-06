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
| `bricks.py` | grid → placements + parts list (**1×1 today**; the seam for larger bricks) |
| `bags.py` | split into build sections |
| `pdf.py` | preview + BrickLink BOM PDF |
| `main.py` | FastAPI wiring |

## Roadmap

**Next step:** larger bricks. Only `bricks.fit_bricks` changes — it will merge
adjacent same-color studs into 1×2 / 2×2 / … parts. The palette, matching, API,
PDF and bag logic already handle variable-size placements
(`brick_width`/`brick_height`), so nothing else moves.
