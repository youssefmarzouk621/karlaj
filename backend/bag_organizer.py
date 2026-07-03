import math
import numpy as np
from color_palette import LegoPalette

palette = LegoPalette()

MAX_BAGS = 6


def organize_bags(grid: list[list[int]], placements: list[dict],
                  width: int, height: int) -> list[dict]:
    grid_arr = np.array(grid)

    # Determine grid subdivision
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

    col_splits = np.linspace(0, width, n_cols + 1, dtype=int)
    row_splits = np.linspace(0, height, n_rows + 1, dtype=int)

    bags = []
    bag_num = 1
    for r in range(n_rows):
        for c in range(n_cols):
            r_start, r_end = int(row_splits[r]), int(row_splits[r + 1])
            c_start, c_end = int(col_splits[c]), int(col_splits[c + 1])
            section_grid = grid_arr[r_start:r_end, c_start:c_end]

            # Assign bricks to this bag based on their top-left corner
            bag_placements = [
                p for p in placements
                if r_start <= p["row"] < r_end and c_start <= p["col"] < c_end
            ]

            # Build parts list for this bag: group by (part_id, color_id)
            counts: dict[tuple[str, int], dict] = {}
            for p in bag_placements:
                key = (p["part_id"], p["color_id"])
                if key not in counts:
                    color = palette.get_color(p["color_id"])
                    counts[key] = {
                        "part_id": p["part_id"],
                        "part_name": p["part_name"],
                        "color_id": p["color_id"],
                        "color_name": color["name"],
                        "rgb": color["rgb"],
                        "quantity": 0,
                    }
                counts[key]["quantity"] += 1

            parts = sorted(counts.values(), key=lambda x: x["quantity"], reverse=True)

            bags.append({
                "bag_number": bag_num,
                "section": {
                    "row_start": r_start,
                    "row_end": r_end,
                    "col_start": c_start,
                    "col_end": c_end,
                },
                "parts": parts,
                "placements": bag_placements,
                "total_parts": len(bag_placements),
                "grid": section_grid.tolist(),
            })
            bag_num += 1

    return bags
