"""The base a mosaic is built on: how many, in what grid, and what joins them.

A base is a part with `kind = 'BASE'` in the parts table (e.g. the 16x16
Technic plate 65803). It is never tiled into the picture — it's the board the
picture sits on. A mosaic larger than one base is built as a grid of bases that
are pinned together through their side holes, so each base is a self-contained
sub-build: plates never straddle a seam (`bricks.fit_bricks`), and each bag
builds exactly one base (`bags.organize_bags`).
"""

from __future__ import annotations

import math

# What joins two neighbouring bases. 65803 has holes along every side; the
# LEGO Art system pins them with friction Technic pins.
PIN_PART_ID = "2780"
PIN_NAME = "Technic Pin with Friction"
# Pins per shared edge. An assumption — confirm against a physical base.
PINS_PER_SEAM = 2


def base_layout(width: int, height: int, base: dict | None) -> dict | None:
    """Grid of bases covering a `width` x `height` stud mosaic, or None when no
    base is configured (the pre-base behavior).

    Sizes that aren't a multiple of the base are covered by rounding up; the
    last row/column of bases is then only partly used (`exact` is False), and
    those studs are left bare.
    """
    if not base:
        return None
    bw, bh = int(base["width"]), int(base["height"])
    cols, rows = math.ceil(width / bw), math.ceil(height / bh)
    seams = rows * (cols - 1) + cols * (rows - 1)
    return {
        "part_id": base["part_id"],
        "name": base["name"],
        "base_width": bw,
        "base_height": bh,
        "rows": rows,
        "cols": cols,
        "count": rows * cols,
        "exact": width % bw == 0 and height % bh == 0,
        "pins": {
            "part_id": PIN_PART_ID,
            "name": PIN_NAME,
            "quantity": seams * PINS_PER_SEAM,
        },
    }


def base_cells(width: int, height: int, layout: dict) -> list[tuple[int, int, int, int]]:
    """Each base's stud area as (row_start, row_end, col_start, col_end), clipped
    to the mosaic, numbered row by row (top-to-bottom, left-to-right)."""
    bw, bh = layout["base_width"], layout["base_height"]
    return [
        (r * bh, min((r + 1) * bh, height), c * bw, min((c + 1) * bw, width))
        for r in range(layout["rows"])
        for c in range(layout["cols"])
    ]
