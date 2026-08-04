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

import cv2
import numpy as np

from attention import BACKGROUND, SILHOUETTE, TEXT
from palette import Palette

MAX_1X1_FRACTION = 0.35

# Largest plate allowed inside a detail region: 1x1 and 1x2 only. Anything
# bigger starts averaging away the shape the region was flagged for.
MAX_DETAIL_AREA = 2

# How much detail tiling may inflate the part count, over plain tiling.
#
# Detail tiling changes the *physical build* — plate seams follow the subject's
# contour instead of cutting across it — but not the picture, because stud
# colors are fixed before tiling ever runs. Left unbounded it doubled the part
# count on a busy portrait (782 -> 1394) for zero change in the rendered
# mosaic, and every extra part is real money and real sorting time. So the
# outline gets small plates only while it stays affordable; past this, the
# tiler falls back to plain merging.
MAX_PART_INFLATION = 0.25

# Fallback parts (the 7 standard plates) used only when the DB has no parts.
# Same shape as db.load_parts(): width, height, BrickLink part_id, name, variable.
DEFAULT_PARTS: list[dict] = [
    {"width": 1, "height": 1, "part_id": "3024", "name": "1x1 Plate", "variable": MAX_1X1_FRACTION},
    {"width": 1, "height": 2, "part_id": "3023", "name": "1x2 Plate", "variable": None},
    {"width": 1, "height": 3, "part_id": "3623", "name": "1x3 Plate", "variable": None},
    {"width": 1, "height": 4, "part_id": "3710", "name": "1x4 Plate", "variable": None},
    {"width": 2, "height": 2, "part_id": "3022", "name": "2x2 Plate", "variable": None},
    {"width": 2, "height": 3, "part_id": "3021", "name": "2x3 Plate", "variable": None},
    {"width": 2, "height": 4, "part_id": "3020", "name": "2x4 Plate", "variable": None},
]

Brick = tuple[int, int, str, str]  # (brick_height, brick_width, part_id, name)


def _orientations(parts: list[dict]) -> list[Brick]:
    """Both rotations of every part as concrete (bh, bw, part_id, name),
    de-duplicated and sorted largest-area first (deterministic tie-break)."""
    seen: set[tuple[int, int]] = set()
    out: list[Brick] = []
    for p in parts:
        w, h = int(p["width"]), int(p["height"])
        for bh, bw in {(h, w), (w, h)}:
            if (bh, bw) in seen:
                continue
            seen.add((bh, bw))
            out.append((bh, bw, p["part_id"], p["name"]))
    out.sort(key=lambda t: (-(t[0] * t[1]), t[0], t[1]))
    return out


def _tiers(parts: list[dict]) -> list[list[Brick]]:
    """Build catalogs from the enabled parts, biggest-first. Tier 0 keeps every
    shape (fewest parts, highest 1x1 share); each later tier drops the current
    largest shape (more parts, lower 1x1 share). 1x1 is always retained so single
    leftover cells are coverable. The final degenerate tier (1x1-only) is last."""
    have_1x1 = any(p["width"] == 1 and p["height"] == 1 for p in parts)
    plist = list(parts)
    if not have_1x1:  # guarantee coverage even if 1x1 was left disabled
        plist.append({"width": 1, "height": 1, "part_id": "3024", "name": "1x1 Plate"})

    full = _orientations(plist)
    ones = [o for o in full if o[0] == 1 and o[1] == 1]
    bigger = [o for o in full if not (o[0] == 1 and o[1] == 1)]  # largest-first
    return [bigger[k:] + ones for k in range(len(bigger) + 1)]


def _despeckle_isolated(grid: np.ndarray, protect: np.ndarray | None = None) -> np.ndarray:
    """Snap studs with zero same-color 8-neighbors to their dominant neighbor.

    `protect` marks studs to leave alone. In a detail region an isolated stud
    is often signal rather than noise — a catchlight in an eye, the gap inside
    a letter — and erasing it costs exactly the detail the region was flagged
    for. In the background it is noise, and removing it lets the stud merge
    into a neighbouring plate.
    """
    rows, cols = grid.shape
    out = grid.copy()
    for r in range(rows):
        for c in range(cols):
            if protect is not None and protect[r, c]:
                continue
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
                expanded: list[tuple[int, int, str, str]],
                detail: np.ndarray | None = None) -> list[dict]:
    """Greedy top-left scan; at each uncovered stud place the largest brick that
    fits (in bounds, uncovered, all one color). 1x1 is always in the catalog.

    `detail` is an optional boolean mask of studs that should be built from
    small plates. Inside it, bricks are capped at `MAX_DETAIL_AREA`, and no
    brick may straddle the mask boundary. The second rule matters as much as
    the first: a 2x4 plate spanning the edge of a subject drags four studs of
    background into the subject's color (or the reverse), which is exactly how
    a silhouette turns to mush.
    """
    rows, cols = grid.shape
    covered = np.zeros((rows, cols), dtype=bool)
    placements: list[dict] = []
    for r in range(rows):
        for c in range(cols):
            if covered[r, c]:
                continue
            color = int(grid[r, c])
            in_detail = bool(detail[r, c]) if detail is not None else False
            for bh, bw, part_id, part_name in expanded:
                if in_detail and bh * bw > MAX_DETAIL_AREA:
                    continue
                if r + bh > rows or c + bw > cols:
                    continue
                if covered[r:r + bh, c:c + bw].any():
                    continue
                if not np.all(grid[r:r + bh, c:c + bw] == color):
                    continue
                if detail is not None and not np.all(detail[r:r + bh, c:c + bw] == in_detail):
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


def _cap_from_parts(parts: list[dict]) -> float:
    """The 1x1 max-fraction cap = the 1x1 part's `variable` (fallback to the
    module default when absent)."""
    for p in parts:
        if p["width"] == 1 and p["height"] == 1 and p.get("variable") is not None:
            return float(p["variable"])
    return MAX_1X1_FRACTION


def _edge_band(mask: np.ndarray, width: int = 2) -> np.ndarray:
    """The inside border of a region, `width` studs thick.

    Small plates are worth paying for along a subject's outline, where brick
    seams either follow the shape or blur it. They are mostly wasted in its
    *interior*, which is broad areas of similar color that a 2x4 renders just
    as faithfully. Treating the whole silhouette as detail doubled the part
    count on a busy image for no measurable fidelity gain.
    """
    if not mask.any():
        return mask
    kernel = np.ones((3, 3), np.uint8)
    eroded = cv2.erode(mask.astype(np.uint8), kernel, iterations=width)
    return (mask.astype(np.uint8) & ~eroded).astype(bool)


def _detail_plans(priority: np.ndarray | None) -> list[np.ndarray | None]:
    """Detail masks to try, most ambitious first.

    Spending the 1x1 budget on detail is a want, not a requirement, so each
    plan is a fallback for the one before it:

        1. silhouette outline + text  — everything we detected
        2. silhouette outline only    — text gives up its 1x1s first
        3. none                       — plain tiling, the original behavior

    The ordering is the product rule: when the budget can't cover both, the
    subject keeps its detail and the lettering loses it, because a recognisable
    subject is worth more than crisp text at arm's length.
    """
    if priority is None or not priority.any():
        return [None]

    has_text = bool((priority == TEXT).any())
    outline = _edge_band(priority == SILHOUETTE)
    # Text is thin enough that its whole area is "outline"; don't erode it.
    text = priority == TEXT

    plans: list[np.ndarray | None] = []
    if has_text and outline.any():
        plans.append(outline | text)
    plans.append(outline if outline.any() else text)
    plans.append(None)
    return plans


def fit_bricks(index_grid: np.ndarray, palette: Palette, parts: list[dict],
               max_1x1_fraction: float | None = None,
               priority: np.ndarray | None = None) -> tuple[list[dict], np.ndarray]:
    """Merge same-color studs into the enabled plates, keeping 1x1s at or under
    the cap.

    - Only the shapes in `parts` are used.
    - If 1x1 is the only enabled shape, the artwork is all 1x1 and the cap is
      ignored (there is nothing to cap against).
    - Otherwise tile with the largest catalog whose 1x1 share is <= the cap
      (the 1x1 part's `variable`, or `max_1x1_fraction` if given).

    `priority` (from `attention.priority_map`) steers *where* the 1x1s go. The
    cap is a budget, and without steering it gets spent wherever the greedy
    scan happens to leave gaps — measured at 73-77% in the background, which
    buys nothing a 2x4 plate wouldn't. Detail regions are built from small
    plates whose edges follow the subject; the background merges into big
    plates, which frees enough budget to pay for it.

    Returns (placements, grid_used) — `grid_used` is the lightly-despeckled index
    grid the placements were built from, so the color grid agrees with them.
    """
    # Protect isolated studs only along a subject's outline and inside text —
    # there a lone stud is usually signal (a letter stem, a contour that turns
    # a corner). Across a subject's *interior* it is skin texture and sensor
    # noise: protecting all of it kept the 1x1 share at ~49%, which forced the
    # cap search down to a tiny-plate catalog and doubled the part count.
    protect = None
    if priority is not None:
        protect = _edge_band(priority == SILHOUETTE) | (priority == TEXT)
    grid = _despeckle_isolated(np.asarray(index_grid), protect)
    cap = max_1x1_fraction if max_1x1_fraction is not None else _cap_from_parts(parts)

    tiers = _tiers(parts)
    if len(tiers) == 1:                          # only 1x1 available -> all 1x1
        return _greedy_fit(grid, palette, tiers[0]), grid

    usable = tiers[:-1]                          # drop the degenerate 1x1-only tier

    def best_under_cap(detail: np.ndarray | None) -> tuple[list[dict], bool]:
        """Largest-brick fit under the 1x1 cap; flag says whether the cap held."""
        last: list[dict] = []
        for expanded in usable:                  # biggest bricks first
            candidate = _greedy_fit(grid, palette, expanded, detail)
            if _fraction_1x1(candidate) <= cap:
                return candidate, True
            last = candidate
        return last, False                       # best effort (rare)

    plain, plain_ok = best_under_cap(None)
    budget = len(plain) * (1.0 + MAX_PART_INFLATION)

    for detail in _detail_plans(priority):       # most detail first
        if detail is None:
            break                                # exhausted; `plain` is the answer
        candidate, ok = best_under_cap(detail)
        if ok and len(candidate) <= budget:
            return candidate, grid
    return plain if (plain_ok or plain) else [], grid


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
