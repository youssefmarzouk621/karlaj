"""Regression harness: render every image in inputs/ at several stud sizes and
compose them into one labeled contact sheet.

Usage (from backend/, venv active):
    python tools/contact_sheet.py                      # -> results/contact_sheet.png
    python tools/contact_sheet.py --sizes 48 96 --out /tmp/sheet.png

Each cell shows the mosaic (color IDs -> palette RGB, NEAREST upscale) labeled
with image name, stud size, the chosen preprocessing profile, and the filter
steps that ran. The first column shows the center-cropped source for reference.
This sheet is the visual guardrail for any preprocessing change.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from processor import process_image, palette  # noqa: E402

INPUT_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
CELL = 384          # display size of each mosaic cell (divisible by 48, 64, 96)
LABEL_H = 78        # label strip under each cell
PAD = 14
BG = (24, 24, 28)
FG = (235, 235, 235)
DIM = (160, 160, 170)


def _font(size: int):
    for path in ("/System/Library/Fonts/Menlo.ttc",
                 "/System/Library/Fonts/Helvetica.ttc"):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def grid_to_image(grid: list[list[int]], cell_px: int) -> Image.Image:
    """Map a color-ID grid to RGB and upscale NEAREST to cell_px square-ish."""
    arr = np.array([[palette.get_rgb(cid) for cid in row] for row in grid],
                   dtype=np.uint8)
    img = Image.fromarray(arr)
    scale = max(1, cell_px // max(img.width, img.height))
    return img.resize((img.width * scale, img.height * scale), Image.NEAREST)


def center_crop_square(img: Image.Image) -> Image.Image:
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    return img.crop((left, top, left + side, top + side))


def steps_summary(report: dict) -> list[str]:
    lines = []
    for step in report["steps"]:
        params = ",".join(f"{k}={v}" for k, v in step["params"].items())
        lines.append(f"{step['filter']}({params})")
    return lines or ["(no filters)"]


def wrap(lines: list[str], width: int) -> list[str]:
    out = []
    for line in lines:
        while len(line) > width:
            out.append(line[:width])
            line = line[width:]
        out.append(line)
    return out


def build_sheet(input_dir: Path, sizes: list[int], out_path: Path) -> None:
    images = sorted(p for p in input_dir.iterdir()
                    if p.suffix.lower() in INPUT_EXTS)
    if not images:
        raise SystemExit(f"no images found in {input_dir}")

    cols = 1 + len(sizes)                      # source + one column per size
    rows = len(images)
    cell_h = CELL + LABEL_H
    sheet = Image.new("RGB", (PAD + cols * (CELL + PAD),
                              PAD + rows * (cell_h + PAD)), BG)
    draw = ImageDraw.Draw(sheet)
    font = _font(15)
    font_small = _font(12)

    for row, path in enumerate(images):
        y0 = PAD + row * (cell_h + PAD)
        data = path.read_bytes()

        # Reference column: the center-cropped source.
        src = center_crop_square(Image.open(path).convert("RGB"))
        src = src.resize((CELL, CELL), Image.LANCZOS)
        sheet.paste(src, (PAD, y0))
        draw.text((PAD + 4, y0 + CELL + 6), f"{path.name} — source",
                  fill=FG, font=font)

        for col, size in enumerate(sizes, start=1):
            print(f"  {path.name} @ {size}x{size} ...", flush=True)
            result = process_image(data, size, size)
            report = result["preprocessing"]
            cell = grid_to_image(result["grid"], CELL)
            x0 = PAD + col * (CELL + PAD)
            sheet.paste(cell, (x0 + (CELL - cell.width) // 2,
                               y0 + (CELL - cell.height) // 2))
            label = [f"{path.name}  {size}x{size}  profile={report['profile']}"]
            body = wrap(steps_summary(report), 52)
            draw.text((x0 + 4, y0 + CELL + 6), label[0], fill=FG, font=font)
            for i, line in enumerate(body[:3]):
                draw.text((x0 + 4, y0 + CELL + 26 + i * 15), line,
                          fill=DIM, font=font_small)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
    print(f"wrote {out_path}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--sizes", type=int, nargs="+", default=[48, 64, 96])
    ap.add_argument("--inputs", type=Path, default=BACKEND_DIR / "inputs")
    ap.add_argument("--out", type=Path,
                    default=BACKEND_DIR / "results" / "contact_sheet.png")
    args = ap.parse_args()
    build_sheet(args.inputs, args.sizes, args.out)


if __name__ == "__main__":
    main()
