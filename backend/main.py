import uuid
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware

from processor import process_image
from bag_organizer import organize_bags
from pdf_generator import generate_pdf

app = FastAPI(title="LEGO Mosaic API")

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

    mosaic_data = process_image(image_bytes, width, height)
    bags = organize_bags(mosaic_data["grid"], mosaic_data["placements"], width, height)
    pdf_bytes = generate_pdf(mosaic_data, bags)

    job_id = str(uuid.uuid4())
    jobs[job_id] = {
        "mosaic": mosaic_data,
        "bags": [
            {
                "bag_number": b["bag_number"],
                "section": b["section"],
                "parts": b["parts"],
                "total_parts": b["total_parts"],
            }
            for b in bags
        ],
        "pdf": pdf_bytes,
    }

    return {
        "job_id": job_id,
        "width": mosaic_data["width"],
        "height": mosaic_data["height"],
        "grid": mosaic_data["grid"],
        "placements": mosaic_data["placements"],
        "parts_list": mosaic_data["parts_list"],
        "total_parts": mosaic_data["total_parts"],
        "bags": jobs[job_id]["bags"],
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
