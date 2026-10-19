"""Before/after renders of the mosaic pipeline, for judging changes by eye.

    venv/bin/python optimization/compare.py --tag baseline   # current code, steps off
    venv/bin/python optimization/compare.py                  # before (steps off) vs after (on)

Renders every mosaic as **round tiles on a black base**, the way the physical
build looks (and the way the reference build in `reference/` was made), at the
same scale as the source next to it.

Output, under `optimization/out/<tag>/` (gitignored — kept locally for review):

    <image>_<W>x<H>/source.png        the cropped source
    <image>_<W>x<H>/before.png        new quality steps off (= the old pipeline)
    <image>_<W>x<H>/after.png         new quality steps on   (not in a baseline run)
    <image>_<W>x<H>/side_by_side.png  source | before | after
    summary.md                        per-stage timings, studs changed, parts
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from attention import priority_map  # noqa: E402
from bricks import DEFAULT_PARTS, fit_bricks  # noqa: E402
from db import load_base, load_palette_colors, load_parts  # noqa: E402
from mosaic import prepare_source, quantize  # noqa: E402
from palette import BRICK_COLORS, Palette  # noqa: E402

try:  # the new stage; absent in a baseline checkout
    import ink  # noqa: E402
except ImportError:
    ink = None

CASES: list[tuple[str, int, int]] = [
    ("gta6.jpg", 80, 128),
    ("gta6.jpg", 96, 96),
    ("21.jpg", 48, 48), ("21.jpg", 96, 96),
    ("wed.jpg", 48, 48), ("wed.jpg", 96, 96),
    ("messi.jpg", 48, 48), ("messi.jpg", 96, 96),
    ("kanye.jpeg", 48, 48), ("kanye.jpeg", 96, 96),
    ("album drake.jpeg", 48, 48), ("album drake.jpeg", 96, 96),
]

BASE_BGR = (20, 20, 20)   # the black base plate showing between round tiles
OUT_LONG_SIDE = 1400      # rendered height/width of the longest side, px


def render_round(grid: np.ndarray, palette: Palette, px: int) -> np.ndarray:
    """Round tiles on a black base, vectorized (one disc mask reused per cell)."""
    h, w = grid.shape
    lut = np.array([c["rgb"][::-1] for c in palette.colors], dtype=np.uint8)
    cells = np.repeat(np.repeat(lut[grid], px, axis=0), px, axis=1)
    yy, xx = np.mgrid[0:px, 0:px] + 0.5
    r = px / 2
    disc = (xx - r) ** 2 + (yy - r) ** 2 <= (0.46 * px) ** 2
    mask = np.tile(disc, (h, w))
    out = np.empty_like(cells)
    out[:] = BASE_BGR
    out[mask] = cells[mask]
    return out


def run_pipeline(image_bytes: bytes, width: int, height: int, palette: Palette,
                 parts: list[dict], base: dict | None, steps_on: bool) -> dict:
    """The /process stages up to tiling, timed. `steps_on` enables ink.py."""
    t: dict[str, float] = {}
    s = time.perf_counter()

    def lap(name: str) -> None:
        nonlocal s
        now = time.perf_counter()
        t[name] = round(1000 * (now - s))
        s = now

    src = prepare_source(image_bytes, width, height); lap("prepare")
    priority = priority_map(src, width, height); lap("attention")
    grid, rgb_small = quantize(src, palette, width, height, priority=priority); lap("quantize")
    protect, stats = None, {}
    if steps_on and ink is not None:
        grid, protect, stats = ink.apply(src, grid, rgb_small, palette); lap("ink")
    placements, grid = fit_bricks(grid, palette, parts, priority=priority, base=base,
                                  **({"protect": protect} if protect is not None else {}))
    lap("fit")
    return {"src": src, "grid": grid, "placements": placements, "timings": t, "stats": stats}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="latest",
                    help="output folder under out/; 'baseline' renders the current code only")
    ap.add_argument("--only", nargs="*", help="limit to these image file names")
    args = ap.parse_args()
    baseline = args.tag == "baseline"

    palette = Palette(load_palette_colors() or BRICK_COLORS)
    parts = load_parts() or DEFAULT_PARTS
    base = load_base()
    out_root = ROOT / "optimization" / "out" / args.tag
    out_root.mkdir(parents=True, exist_ok=True)

    rows = []
    for name, w, h in CASES:
        if args.only and name not in args.only:
            continue
        data = (ROOT / "test_images" / name).read_bytes()
        before = run_pipeline(data, w, h, palette, parts, base, steps_on=False)
        after = None if baseline else run_pipeline(data, w, h, palette, parts, base, steps_on=True)

        px = max(4, OUT_LONG_SIDE // max(w, h))
        src = cv2.resize(before["src"], (w * px, h * px), interpolation=cv2.INTER_AREA)
        b = render_round(before["grid"], palette, px)
        tiles = [src, b]
        d = out_root / f"{Path(name).stem.replace(' ', '_')}_{w}x{h}"
        d.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(d / "source.png"), src)
        cv2.imwrite(str(d / "before.png"), b)
        changed = 0
        if after is not None:
            a = render_round(after["grid"], palette, px)
            cv2.imwrite(str(d / "after.png"), a)
            tiles.append(a)
            changed = int((after["grid"] != before["grid"]).sum())
        gap = np.full((src.shape[0], 12, 3), 255, dtype=np.uint8)
        side = [tiles[0]]
        for tile in tiles[1:]:
            side += [gap, tile]
        cv2.imwrite(str(d / "side_by_side.png"), np.hstack(side))

        run = after or before
        rows.append((name, w, h, run["timings"], changed, w * h,
                     len(before["placements"]), len(run["placements"]), run["stats"]))
        print(f"{name:<18} {w}x{h:<4} {sum(run['timings'].values()):>5} ms  "
              f"changed {changed:>5} ({100 * changed / (w * h):4.1f}%)  -> {d}")

    lines = [f"# Mosaic comparison — `{args.tag}`", "",
             "Generator stages up to tiling (PDF/bags excluded), ms. "
             "Changed = studs that differ between before and after.", "",
             "| image | size | stages (ms) | total ms | changed | parts before → after | ink stats |",
             "|---|---|---|---|---|---|---|"]
    for name, w, h, t, changed, n, pb, pa, st in rows:
        stages = ", ".join(f"{k} {v}" for k, v in t.items())
        lines.append(f"| {name} | {w}×{h} | {stages} | {sum(t.values())} | "
                     f"{changed} ({100 * changed / n:.1f}%) | {pb} → {pa} | {st or ''} |")
    (out_root / "summary.md").write_text("\n".join(lines) + "\n")
    print(f"\nsummary: {out_root / 'summary.md'}")


if __name__ == "__main__":
    main()
