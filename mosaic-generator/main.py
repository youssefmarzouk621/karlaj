"""mosaic-generator — a fast FastAPI LEGO-mosaic service.

Inspired by brickmos: same 33-color BrickLink palette, same Euclidean-RGB
nearest-color mapping, same linear downsample, and deliberately no flattening
preprocessing — so the colors/shading match brickmos. Matching is vectorized,
so a mosaic generates in a few milliseconds.

The response shape matches the other services (`/process`, `/pdf/{job_id}`), so
the frontend can point at this one via `PYTHON_API_URL`.

Run:  uvicorn main:app --reload --port 8002
"""

import json
import time
import uuid

import numpy as np

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from starlette.concurrency import run_in_threadpool

from attention import BACKGROUND, priority_map
from palette import Palette, BRICK_COLORS
from mosaic import prepare_source, quantize
from bricks import index_grid_to_color_grid, fit_bricks, build_parts_list, DEFAULT_PARTS
from bags import organize_bags
from pdf import generate_pdf
from db import load_base, load_connector, load_palette_colors, load_parts
from base import base_layout
import ink

app = FastAPI(title="mosaic-generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs: dict[str, dict] = {}


def _json_default(value):
    """numpy scalars/arrays that reach the response."""
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return value.tolist()
    raise TypeError(f"not JSON serializable: {type(value).__name__}")


class MosaicJSONResponse(JSONResponse):
    """`json.dumps` straight from the dict. FastAPI's default path runs every
    value through `jsonable_encoder` first, which took ~1.2 s on a 128x128
    response (16k placements) against ~0.1 s for this — a quarter of the
    5 s budget."""

    def render(self, content) -> bytes:
        return json.dumps(content, separators=(",", ":"), default=_json_default).encode("utf-8")

MIN_SIZE = 16
MAX_SIZE = 128


@app.post("/process")
async def process(
    image: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
    crop_x: float = Form(0.5),
    crop_y: float = Form(0.5),
):
    if not (MIN_SIZE <= width <= MAX_SIZE and MIN_SIZE <= height <= MAX_SIZE):
        raise HTTPException(400, f"Dimensions must be between {MIN_SIZE} and {MAX_SIZE}")
    # Where the crop window sits on the photo, 0..1 per axis (0.5 = centered).
    if not (0.0 <= crop_x <= 1.0 and 0.0 <= crop_y <= 1.0):
        raise HTTPException(400, "crop_x and crop_y must be between 0 and 1")

    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image (JPEG or PNG)")

    image_bytes = await image.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 20MB")

    # Per-stage wall time, reported in `preprocessing.metrics.timings_ms`:
    # /process has a 5 s budget at the largest size.
    timings: dict[str, int] = {}
    mark = time.perf_counter()

    def lap(stage: str) -> None:
        nonlocal mark
        now = time.perf_counter()
        timings[stage] = round(1000 * (now - mark))
        mark = now

    # Load the active config fresh from the DB (so dashboard edits take effect
    # immediately); fall back to the built-in defaults if the DB is unavailable.
    palette = Palette(load_palette_colors() or BRICK_COLORS)
    parts = load_parts() or DEFAULT_PARTS
    # The board it's built on. None (no base enabled / DB down) = no seam rule,
    # free-form bags, no base in the response — the pre-base behavior.
    base = load_base()
    layout = base_layout(width, height, base, load_connector() if base else None)
    lap("config")

    try:
        cropped = prepare_source(image_bytes, width, height, crop_x=crop_x, crop_y=crop_y)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    lap("decode")

    # Where detail is worth paying for: the salient subject and any lettering.
    # Detection runs on the cropped source, where strokes and edges still
    # exist — the stud grid is far too coarse to find anything in.
    priority = priority_map(cropped, width, height)
    lap("attention")

    # The priority map steers both halves of the pipeline: quantization samples
    # those studs crisply instead of smoothing them (this is what makes the
    # subject read), and the tiler builds them from small plates whose edges
    # follow the shape (this is what makes the physical build follow it).
    index_grid, rgb_small = quantize(cropped, palette, width, height,
                                     priority=priority)
    lap("quantize")

    # Black where the picture is black: dark areas, and the artwork's ink lines
    # that the area average dissolved. Line studs are protected from the
    # despeckle so one-stud outline pieces survive. See ink.py.
    index_grid, ink_mask, ink_stats = ink.apply(cropped, index_grid, rgb_small, palette)
    lap("ink")

    placements, index_grid = fit_bricks(index_grid, palette, parts, priority=priority,
                                        base=base, protect=ink_mask)
    lap("fit")
    grid = index_grid_to_color_grid(index_grid, palette)
    parts_list = build_parts_list(placements)
    bags = organize_bags(placements, width, height, layout)
    lap("bags")

    mosaic_data = {
        "width": width,
        "height": height,
        "grid": grid,
        "placements": placements,
        "parts_list": parts_list,
        "total_parts": len(placements),
        "base_layout": layout,
        "preprocessing": {
            "profile": "mosaic-generator",
            "steps": [] if "skipped" in ink_stats else ["ink"],
            "metrics": {**ink_stats, "timings_ms": timings},
        },
    }

    # The PDF is built on first download (GET /pdf), not here: it was ~0.8 s of
    # every generation at 80x128, for a file most customers never open.
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"mosaic": mosaic_data, "pdf": None}

    return MosaicJSONResponse({"job_id": job_id, **mosaic_data, "bags": bags})


@app.get("/pdf/{job_id}")
async def get_pdf(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    if job["pdf"] is None:
        job["pdf"] = await run_in_threadpool(generate_pdf, job["mosaic"])
    return Response(
        content=job["pdf"],
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=lego-mosaic-{job_id[:8]}.pdf"},
    )
