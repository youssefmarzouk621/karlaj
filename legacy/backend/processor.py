import numpy as np
from PIL import Image
from io import BytesIO
from color_palette import LegoPalette
from image_analysis import analyze_image
from filter_profiles import build_recipe, apply_recipe
from grid_cleanup import clean_grid
from brick_fitter import fit_bricks, build_brick_parts_list, load_parts_config

palette = LegoPalette()

# Preprocessing (analysis + filters) always runs at this FIXED resolution (long
# side, in pixels), regardless of the requested stud count. This is what makes
# the pipeline resolution-robust: the filters see the exact same image whether
# the user asked for 48 or 96 studs — only the final downsample differs.
# (Previously the working size scaled with the stud grid, so every filter hit
# a 48-stud request twice as hard as a 96-stud one.) See PIPELINE.md "Stage 0".
WORK_SIZE = 512


def _preprocess(img: Image.Image) -> tuple[Image.Image, dict]:
    """Analyze the image and apply the filter recipe chosen for it.

    Returns the filtered image plus a report of the metrics and recipe used, so
    the caller can surface *why* an image was treated the way it was.
    """
    scale = WORK_SIZE / max(img.width, img.height)
    work_w = max(1, round(img.width * scale))
    work_h = max(1, round(img.height * scale))
    arr = np.array(img.resize((work_w, work_h), Image.LANCZOS))

    metrics = analyze_image(arr)
    recipe = build_recipe(metrics)
    arr = apply_recipe(arr, recipe)

    report = {
        "metrics": {k: round(v, 4) for k, v in metrics.items()},
        "profile": recipe["profile"],
        "steps": [{"filter": n, "params": p} for n, p in recipe["steps"]],
    }
    return Image.fromarray(arr), report


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

    # Stage 0: analyze the image and apply the filter recipe chosen for it
    img, preprocessing = _preprocess(img)

    # Resize to stud dimensions — each pixel becomes one LEGO stud
    img = img.resize((width, height), Image.LANCZOS)
    pixels = np.array(img)

    # Map to LEGO colors
    color_grid = palette.match_image(pixels)

    # Light cleanup: snap isolated studs and lone perceptual outliers
    # (e.g. a red stud in a cheek) to their dominant neighbor color.
    color_grid = clean_grid(color_grid, palette)
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
        "preprocessing": preprocessing,
    }
