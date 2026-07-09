from __future__ import annotations

import json
import random
import numpy as np
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).parent / "data"


def load_parts_config() -> list[dict]:
    with open(DATA_DIR / "lego_parts.json") as f:
        return json.load(f)


def fit_bricks(color_grid: list[list[int]], parts: Optional[list[dict]] = None) -> list[dict]:
    """
    Fill a color grid with randomly chosen LEGO bricks.
    Larger bricks are always tried before smaller ones.
    1x1 bricks are only used as a last resort.
    """
    if parts is None:
        parts = load_parts_config()

    grid = np.array(color_grid)
    rows, cols = grid.shape
    covered = np.zeros((rows, cols), dtype=bool)

    # Separate 1x1 parts from larger parts
    large_parts = [p for p in parts if p["width"] * p["height"] > 1]
    small_parts = [p for p in parts if p["width"] * p["height"] == 1]

    # Group large parts by area (descending) for tiered selection
    # Within each tier, build weighted candidates for randomization
    from collections import defaultdict
    tiers: dict[int, list[dict]] = defaultdict(list)
    for p in large_parts:
        area = p["width"] * p["height"]
        tiers[area].extend([p] * p["weight"])

    # Sort tiers largest-first
    sorted_tiers = sorted(tiers.items(), key=lambda x: -x[0])

    # Build weighted 1x1 candidates for fallback
    small_candidates = []
    for p in small_parts:
        small_candidates.extend([p] * p["weight"])

    placements: list[dict] = []

    for r in range(rows):
        for c in range(cols):
            if covered[r, c]:
                continue

            color_id = int(grid[r, c])
            placed = False

            # Try each tier from largest area down
            for _area, tier_candidates in sorted_tiers:
                random.shuffle(tier_candidates)

                for part in tier_candidates:
                    pw, ph = part["width"], part["height"]
                    orientations = [(ph, pw)] if pw == ph else [(ph, pw), (pw, ph)]

                    for bh, bw in orientations:
                        if r + bh > rows or c + bw > cols:
                            continue

                        region = grid[r:r + bh, c:c + bw]
                        covered_region = covered[r:r + bh, c:c + bw]

                        if np.any(covered_region):
                            continue
                        if not np.all(region == color_id):
                            continue

                        covered[r:r + bh, c:c + bw] = True
                        placements.append({
                            "part_id": part["part_id"],
                            "part_name": part["name"],
                            "color_id": color_id,
                            "row": r,
                            "col": c,
                            "brick_width": bw,
                            "brick_height": bh,
                        })
                        placed = True
                        break

                    if placed:
                        break
                if placed:
                    break

            if not placed:
                # Last resort: pick a random 1x1 part
                covered[r, c] = True
                if small_candidates:
                    part = random.choice(small_candidates)
                    placements.append({
                        "part_id": part["part_id"],
                        "part_name": part["name"],
                        "color_id": color_id,
                        "row": r,
                        "col": c,
                        "brick_width": 1,
                        "brick_height": 1,
                    })
                else:
                    placements.append({
                        "part_id": "3024",
                        "part_name": "1x1 Plate",
                        "color_id": color_id,
                        "row": r,
                        "col": c,
                        "brick_width": 1,
                        "brick_height": 1,
                    })

    return placements


def build_brick_parts_list(placements: list[dict], palette) -> list[dict]:
    """Aggregate placements into a parts list grouped by (part_id, color_id)."""
    counts: dict[tuple[str, int], dict] = {}
    for p in placements:
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

    result = sorted(counts.values(), key=lambda x: x["quantity"], reverse=True)
    return result
