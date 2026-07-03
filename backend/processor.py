import numpy as np
from PIL import Image
from io import BytesIO
from color_palette import LegoPalette
from brick_fitter import fit_bricks, build_brick_parts_list, load_parts_config

palette = LegoPalette()


def process_image(image_bytes: bytes, width: int, height: int) -> dict:
    img = Image.open(BytesIO(image_bytes)).convert("RGB")

    # Crop to target aspect ratio (center crop)
    target_ratio = width / height
    img_ratio = img.width / img.height

    if img_ratio > target_ratio:
        new_w = int(img.height * target_ratio)
        left = (img.width - new_w) // 2
        img = img.crop((left, 0, left + new_w, img.height))
    elif img_ratio < target_ratio:
        new_h = int(img.width / target_ratio)
        top = (img.height - new_h) // 2
        img = img.crop((0, top, img.width, top + new_h))

    # Resize to stud dimensions — each pixel becomes one LEGO stud
    img = img.resize((width, height), Image.LANCZOS)
    pixels = np.array(img)

    # Map to LEGO colors
    color_grid = palette.match_image(pixels)
    grid_list = color_grid.tolist()

    # Fit bricks of various sizes
    parts_config = load_parts_config()
    placements = fit_bricks(grid_list, parts_config)
    parts_list = build_brick_parts_list(placements, palette)

    return {
        "width": width,
        "height": height,
        "grid": grid_list,
        "placements": placements,
        "parts_list": parts_list,
        "total_parts": len(placements),
    }
