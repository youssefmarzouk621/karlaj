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

from palette import Palette
from mosaic import image_to_index_grid
from bricks import index_grid_to_color_grid, fit_bricks, build_parts_list
from bags import organize_bags
from pdf import generate_pdf

app = FastAPI(title="mosaic-generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

palette = Palette()
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

    try:
        index_grid = image_to_index_grid(image_bytes, palette, width, height)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None

    # Merge same-color studs into larger plates. Returns the (lightly cleaned)
    # grid the bricks were built from, so `grid` and `placements` agree.
    placements, index_grid = fit_bricks(index_grid, palette)
    grid = index_grid_to_color_grid(index_grid, palette)
    parts_list = build_parts_list(placements)
    bags = organize_bags(placements, width, height)

    mosaic_data = {
        "width": width,
        "height": height,
        "grid": grid,
        "placements": placements,
        "parts_list": parts_list,
        "total_parts": len(placements),
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
