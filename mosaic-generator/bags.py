"""Split the mosaic into rectangular build sections ("bags"). Ported from the
brickmos service so the API response matches the other services."""

from __future__ import annotations

import math

MAX_BAGS = 6


def organize_bags(placements: list[dict], width: int, height: int) -> list[dict]:
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
                    "row_start": r_start, "row_end": r_end,
                    "col_start": c_start, "col_end": c_end,
                },
                "parts": sorted(counts.values(), key=lambda x: x["quantity"], reverse=True),
                "total_parts": len(bag_placements),
            })
            bag_num += 1

    return bags
