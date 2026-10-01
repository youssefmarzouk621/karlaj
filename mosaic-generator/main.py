"""mosaic-generator — a fast FastAPI LEGO-mosaic service.

Inspired by brickmos: same 33-color BrickLink palette, same Euclidean-RGB
nearest-color mapping, same linear downsample, and deliberately no flattening
preprocessing — so the colors/shading match brickmos. Matching is vectorized,
so a mosaic generates in a few milliseconds.

The response shape matches the other services (`/process`, `/pdf/{job_id}`), so
the frontend can point at this one via `PYTHON_API_URL`.

Run:  uvicorn main:app --reload --port 8002
"""

import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from attention import BACKGROUND, priority_map
from palette import Palette, BRICK_COLORS
from mosaic import prepare_source, quantize
from bricks import index_grid_to_color_grid, fit_bricks, build_parts_list, DEFAULT_PARTS
from bags import organize_bags
from pdf import generate_pdf
from db import load_base, load_palette_colors, load_parts
from base import base_layout

app = FastAPI(title="mosaic-generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs: dict[str, dict] = {}

MIN_SIZE = 16
MAX_SIZE = 96


@app.post("/process")
async def process(
    image: UploadFile = File(...),
    width: int = Form(...),
    height: int = Form(...),
):
    if not (MIN_SIZE <= width <= MAX_SIZE and MIN_SIZE <= height <= MAX_SIZE):
        raise HTTPException(400, f"Dimensions must be between {MIN_SIZE} and {MAX_SIZE}")

    content_type = image.content_type or ""
    if not content_type.startswith("image/"):
        raise HTTPException(400, "File must be an image (JPEG or PNG)")

    image_bytes = await image.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 20MB")

    # Load the active config fresh from the DB (so dashboard edits take effect
    # immediately); fall back to the built-in defaults if the DB is unavailable.
    palette = Palette(load_palette_colors() or BRICK_COLORS)
    parts = load_parts() or DEFAULT_PARTS
    # The board it's built on. None (no base enabled / DB down) = no seam rule,
    # free-form bags, no base in the response — the pre-base behavior.
    base = load_base()
    layout = base_layout(width, height, base)

    try:
        cropped = prepare_source(image_bytes, width, height)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None

    # Where detail is worth paying for: the salient subject and any lettering.
    # Detection runs on the cropped source, where strokes and edges still
    # exist — the stud grid is far too coarse to find anything in.
    priority = priority_map(cropped, width, height)

    # The priority map steers both halves of the pipeline: quantization samples
    # those studs crisply instead of smoothing them (this is what makes the
    # subject read), and the tiler builds them from small plates whose edges
    # follow the shape (this is what makes the physical build follow it).
    index_grid, rgb_small = quantize(cropped, palette, width, height,
                                     priority=priority)
    placements, index_grid = fit_bricks(index_grid, palette, parts, priority=priority,
                                        base=base)
    grid = index_grid_to_color_grid(index_grid, palette)
    parts_list = build_parts_list(placements)
    bags = organize_bags(placements, width, height, layout)

    mosaic_data = {
        "width": width,
        "height": height,
        "grid": grid,
        "placements": placements,
        "parts_list": parts_list,
        "total_parts": len(placements),
        "base_layout": layout,
        "preprocessing": {"profile": "mosaic-generator", "steps": [], "metrics": {}},
    }

    job_id = str(uuid.uuid4())
    jobs[job_id] = {"mosaic": mosaic_data, "pdf": generate_pdf(mosaic_data)}

    return {"job_id": job_id, **mosaic_data, "bags": bags}


@app.get("/pdf/{job_id}")
async def get_pdf(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return Response(
        content=job["pdf"],
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=lego-mosaic-{job_id[:8]}.pdf"},
    )
