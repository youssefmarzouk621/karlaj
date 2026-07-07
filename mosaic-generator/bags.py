"""Split the mosaic into rectangular build sections ("bags").

Real LEGO sets don't dump every piece into a handful of huge bags — each
numbered bag builds one manageable chunk of the model, usually on the order of
~50–90 parts. We mirror that: pick the bag count from a target parts-per-bag,
then carve the mosaic into that many contiguous rectangular sections, numbered
row by row so they build top-to-bottom, left-to-right."""

from __future__ import annotations

import math

# Target pieces in a single bag. Tuned to feel like a real LEGO bag: enough to
# be a satisfying sub-build, few enough that sorting them isn't a chore.
TARGET_PARTS_PER_BAG = 70
MAX_BAGS = 18
MIN_BAGS = 1


def _grid_shape(n_bags: int, width: int, height: int) -> tuple[int, int]:
    """Pick n_rows × n_cols close to `n_bags` while keeping each section as
    square as the mosaic's aspect ratio allows."""
    if n_bags <= 1 or width <= 0 or height <= 0:
        return 1, 1

    best: tuple[float, int, int] | None = None
    for n_rows in range(1, n_bags + 1):
        n_cols = math.ceil(n_bags / n_rows)
        total = n_rows * n_cols
        if total > MAX_BAGS:
            continue
        # Cell aspect vs. square (1.0 is ideal); penalise overshooting n_bags.
        cell_ratio = (width / n_cols) / (height / n_rows)
        squareness = max(cell_ratio, 1 / cell_ratio)
        overshoot = total - n_bags
        score = squareness + overshoot * 0.15
        if best is None or score < best[0]:
            best = (score, n_rows, n_cols)

    return (best[1], best[2]) if best else (1, 1)


def organize_bags(placements: list[dict], width: int, height: int) -> list[dict]:
    total_parts = len(placements)
    if total_parts == 0:
        return []

    n_bags_target = math.ceil(total_parts / TARGET_PARTS_PER_BAG)
    n_bags_target = max(MIN_BAGS, min(MAX_BAGS, n_bags_target))
    n_rows, n_cols = _grid_shape(n_bags_target, width, height)

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
                    "row_start": r_start, "row_end": r_end,
                    "col_start": c_start, "col_end": c_end,
                },
                "parts": sorted(counts.values(), key=lambda x: x["quantity"], reverse=True),
                "total_parts": len(bag_placements),
            })
            bag_num += 1

    return bags
