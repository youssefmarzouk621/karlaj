"""Stud grid -> brick placements + parts list.

Right now every stud is an independent **1x1 plate** (part 3024), matching
brickmos. This module is the seam for the *next* step: `fit_bricks` is where
same-color runs will be merged into larger bricks (1x2, 2x2, ...). Keeping it
isolated means the palette/matching and the API don't change when that lands —
only this function's output (bigger `brick_width`/`brick_height`, other
`part_id`s) does.
"""

from __future__ import annotations

import numpy as np

from palette import Palette

ONE_BY_ONE_PART_NAME = "1x1 Plate"


def index_grid_to_color_grid(index_grid: np.ndarray, palette: Palette) -> list[list[int]]:
    """Map palette indices -> BrickLink color ids (the API's `grid`)."""
    id_lut = np.array([c["color_id"] for c in palette.colors], dtype=np.int64)
    return id_lut[index_grid].tolist()


def fit_bricks(index_grid: np.ndarray, palette: Palette) -> list[dict]:
    """Return one placement per stud.

    FUTURE (next step): merge adjacent same-color studs into larger bricks here.
    The rest of the pipeline (API shape, PDF, bags) already treats placements as
    variable-size via `brick_width`/`brick_height`, so only this loop changes.
    """
    rows, cols = index_grid.shape
    placements: list[dict] = []
    for r in range(rows):
        for c in range(cols):
            color = palette.colors[int(index_grid[r, c])]
            placements.append({
                "part_id": color["part_id"],
                "part_name": ONE_BY_ONE_PART_NAME,
                "color_id": color["color_id"],
                "color_name": color["name"],
                "rgb": list(color["rgb"]),
                "row": r,
                "col": c,
                "brick_width": 1,
                "brick_height": 1,
            })
    return placements


def build_parts_list(placements: list[dict]) -> list[dict]:
    """Aggregate placements into a parts list keyed by (part_id, color_id)."""
    counts: dict[tuple[str, int], dict] = {}
    for p in placements:
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
    return sorted(counts.values(), key=lambda x: x["quantity"], reverse=True)
