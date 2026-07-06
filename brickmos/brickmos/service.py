"""HTTP upload service for brickmos.

Wraps the existing CLI mosaic pipeline (`mosaic_core.generate_mosaic`) in a
FastAPI app so a browser can upload an image directly (multipart/form-data)
and get back a mosaic (grid + parts list + a downloadable instruction PDF),
the same way the `backend/` FastAPI service works. This lets the frontend
switch between the two services via an environment variable.

Run with:
    uvicorn brickmos.service:app --reload --port 8001
"""

import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from . import defaults
from .mosaic_core import generate_mosaic, read_colors
from .pdf_export import generate_pdf

app = FastAPI(title="brickmos API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

jobs: dict[str, dict] = {}

MIN_SIZE = 16
MAX_SIZE = 96
MAX_BAGS = 6


def _organize_bags(grid: list[list[int]], placements: list[dict], width: int, height: int) -> list[dict]:
    """Splits the mosaic into rectangular sections ("bags") of roughly equal size."""
    import math

    if width <= 24 and height <= 24:
        n_cols, n_rows = 1, 1
    elif width <= 48 and height <= 48:
        n_cols, n_rows = 2, 2
    else:
        n_cols = min(3, math.ceil(width / 24))
        n_rows = min(2, math.ceil(height / 24))

    if n_cols * n_rows > MAX_BAGS:
        n_cols = min(n_cols, 3)
        n_rows = min(n_rows, 2)

    col_splits = [round(width * i / n_cols) for i in range(n_cols + 1)]
    row_splits = [round(height * i / n_rows) for i in range(n_rows + 1)]

    bags = []
    bag_num = 1
    for r in range(n_rows):
        for c in range(n_cols):
            r_start, r_end = row_splits[r], row_splits[r + 1]
            c_start, c_end = col_splits[c], col_splits[c + 1]

            bag_placements = [
                p for p in placements
                if r_start <= p["row"] < r_end and c_start <= p["col"] < c_end
            ]

            counts: dict[tuple[str, int], dict] = {}
            for p in bag_placements:
                key = (p["part_id"], p["color_id"])
                if key not in counts:
                    counts[key] = {
                        "part_id": p["part_id"],
                        "part_name": p["part_name"],
                        "color_id": p["color_id"],
                        "color_name": p["color_name"],
                        "rgb": p["rgb"],
                        "quantity": 0,
                    }
                counts[key]["quantity"] += 1

            bags.append({
                "bag_number": bag_num,
                "section": {
                    "row_start": r_start,
                    "row_end": r_end,
                    "col_start": c_start,
                    "col_end": c_end,
                },
                "parts": sorted(counts.values(), key=lambda x: x["quantity"], reverse=True),
                "total_parts": len(bag_placements),
            })
            bag_num += 1

    return bags


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

    colors = read_colors(defaults.get_default_colors())

    try:
        mosaic = generate_mosaic(image_bytes, colors, width, height)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None

    color_grid = mosaic["color_grid"]

    # Every brickmos "brick" is a 1x1 plate/tile, placed at every stud.
    grid_list: list[list[int]] = []
    placements: list[dict] = []
    parts_counts: dict[tuple[str, int], dict] = {}

    for r, row in enumerate(color_grid):
        grid_row = []
        for c, brick_color in enumerate(row):
            color_id = int(brick_color.colorId)
            grid_row.append(color_id)

            placement = {
                "part_id": brick_color.colorType,
                "part_name": "1x1 Plate",
                "color_id": color_id,
                "color_name": brick_color.colorName,
                "rgb": list(brick_color.rgb),
                "row": r,
                "col": c,
                "brick_width": 1,
                "brick_height": 1,
            }
            placements.append(placement)

            key = (brick_color.colorType, color_id)
            if key not in parts_counts:
                parts_counts[key] = {
                    "part_id": brick_color.colorType,
                    "part_name": "1x1 Plate",
                    "color_id": color_id,
                    "color_name": brick_color.colorName,
                    "rgb": list(brick_color.rgb),
                    "quantity": 0,
                }
            parts_counts[key]["quantity"] += 1
        grid_list.append(grid_row)

    parts_list = sorted(parts_counts.values(), key=lambda x: x["quantity"], reverse=True)
    bags = _organize_bags(grid_list, placements, width, height)

    mosaic_data = {
        "width": width,
        "height": height,
        "grid": grid_list,
        "placements": placements,
        "parts_list": parts_list,
        "total_parts": len(placements),
        "preprocessing": {"profile": "brickmos", "steps": [], "metrics": {}},
    }

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "mosaic": mosaic_data,
        "pdf": generate_pdf(mosaic_data),
    }

    return {
        "job_id": job_id,
        **mosaic_data,
        "bags": bags,
    }


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
