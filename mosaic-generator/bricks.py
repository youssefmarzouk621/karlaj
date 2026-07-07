"""Stud grid -> brick placements + parts list.

Merges same-color runs into larger LEGO plates so the mosaic isn't built
entirely from 1x1s. Two rules keep it faithful to the colors while meeting the
"1x1 must be <= 35% of parts" target:

1. **Light cleanup** (`_despeckle_isolated`): only *fully isolated* studs — a lone
   color with no same-color neighbor at all — are snapped to their dominant
   neighbor. Those are salt-and-pepper noise, not shading; removing them both
   cuts unmergeable 1x1s and lets them join a neighbor's brick. Verified to keep
   the rich brickmos-style shading intact.

2. **Largest-brick-under-cap** (`fit_bricks`): greedily tile with the *biggest*
   plate catalog whose resulting 1x1 share is <= the cap. Bigger bricks shrink
   the total part count, which *raises* the 1x1 fraction, so when a busy image
   would blow the cap we fall back to a smaller-plate catalog (more parts) that
   dilutes the unavoidable isolated 1x1s back under the limit.

Colors are never otherwise changed — the palette match from `mosaic.py` is kept.
"""

from __future__ import annotations

from collections import Counter

import numpy as np

from palette import Palette

MAX_1X1_FRACTION = 0.35

# BrickLink plate ids, keyed by canonical (short_side, long_side).
_PLATES: dict[tuple[int, int], tuple[str, str]] = {
    (1, 1): ("3024", "1x1 Plate"),
    (1, 2): ("3023", "1x2 Plate"),
    (1, 3): ("3623", "1x3 Plate"),
    (1, 4): ("3710", "1x4 Plate"),
    (2, 2): ("3022", "2x2 Plate"),
    (2, 3): ("3021", "2x3 Plate"),
    (2, 4): ("3020", "2x4 Plate"),
}

# Catalogs from most to least aggressive. `fit_bricks` uses the first (biggest
# bricks / fewest parts) that keeps 1x1s under the cap.
_CATALOGS: list[list[tuple[int, int]]] = [
    [(2, 4), (2, 3), (2, 2), (1, 4), (1, 3), (1, 2), (1, 1)],   # full
    [(2, 2), (1, 2), (1, 1)],                                   # medium
    [(1, 2), (1, 1)],                                           # minimal
]


def _expand(catalog: list[tuple[int, int]]) -> list[tuple[int, int, str, str]]:
    """Turn base shapes into concrete (height, width, part_id, name) orientations,
    largest area first (deterministic tie-break)."""
    out: list[tuple[int, int, str, str]] = []
    for w, h in catalog:
        part_id, name = _PLATES[(min(w, h), max(w, h))]
        for bh, bw in {(h, w), (w, h)}:            # both orientations
            out.append((bh, bw, part_id, name))
    out.sort(key=lambda t: (-(t[0] * t[1]), t[0], t[1]))
    return out


_EXPANDED = [_expand(cat) for cat in _CATALOGS]


def _despeckle_isolated(grid: np.ndarray) -> np.ndarray:
    """Snap studs with zero same-color 8-neighbors to their dominant neighbor."""
    rows, cols = grid.shape
    out = grid.copy()
    for r in range(rows):
        for c in range(cols):
            own = grid[r, c]
            neighbors = [grid[r + di, c + dj]
                         for di in (-1, 0, 1) for dj in (-1, 0, 1)
                         if (di or dj) and 0 <= r + di < rows and 0 <= c + dj < cols]
            if neighbors and not any(n == own for n in neighbors):
                out[r, c] = Counter(neighbors).most_common(1)[0][0]
    return out


def _placement(palette: Palette, color_index: int, r: int, c: int,
               bh: int, bw: int, part_id: str, part_name: str) -> dict:
    color = palette.colors[color_index]
    return {
        "part_id": part_id,
        "part_name": part_name,
        "color_id": color["color_id"],
        "color_name": color["name"],
        "rgb": list(color["rgb"]),
        "row": r,
        "col": c,
        "brick_width": bw,
        "brick_height": bh,
    }


def _greedy_fit(grid: np.ndarray, palette: Palette,
                expanded: list[tuple[int, int, str, str]]) -> list[dict]:
    """Greedy top-left scan; at each uncovered stud place the largest brick that
    fits (in bounds, uncovered, all one color). 1x1 is always in the catalog."""
    rows, cols = grid.shape
    covered = np.zeros((rows, cols), dtype=bool)
    placements: list[dict] = []
    for r in range(rows):
        for c in range(cols):
            if covered[r, c]:
                continue
            color = int(grid[r, c])
            for bh, bw, part_id, part_name in expanded:
                if r + bh > rows or c + bw > cols:
                    continue
                if covered[r:r + bh, c:c + bw].any():
                    continue
                if not np.all(grid[r:r + bh, c:c + bw] == color):
                    continue
                covered[r:r + bh, c:c + bw] = True
                placements.append(_placement(palette, color, r, c, bh, bw, part_id, part_name))
                break
    return placements


def _fraction_1x1(placements: list[dict]) -> float:
    if not placements:
        return 0.0
    ones = sum(1 for p in placements if p["brick_width"] == 1 and p["brick_height"] == 1)
    return ones / len(placements)


def fit_bricks(index_grid: np.ndarray, palette: Palette,
               max_1x1_fraction: float = MAX_1X1_FRACTION) -> tuple[list[dict], np.ndarray]:
    """Merge same-color studs into plates, keeping 1x1s at or under the cap.

    Returns (placements, grid_used). `grid_used` is the lightly-despeckled index
    grid the placements were built from — the caller should derive the color grid
    from it so grid and placements agree.
    """
    grid = _despeckle_isolated(np.asarray(index_grid))

    placements = _greedy_fit(grid, palette, _EXPANDED[-1])   # fallback: smallest plates
    for expanded in _EXPANDED:                               # biggest first
        candidate = _greedy_fit(grid, palette, expanded)
        if _fraction_1x1(candidate) <= max_1x1_fraction:
            return candidate, grid                           # largest bricks under the cap
        placements = candidate
    return placements, grid                                  # best effort (rare)


def index_grid_to_color_grid(index_grid: np.ndarray, palette: Palette) -> list[list[int]]:
    """Map palette indices -> BrickLink color ids (the API's `grid`)."""
    id_lut = np.array([c["color_id"] for c in palette.colors], dtype=np.int64)
    return id_lut[np.asarray(index_grid)].tolist()


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
