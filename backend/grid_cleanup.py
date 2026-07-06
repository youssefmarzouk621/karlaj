from __future__ import annotations

from collections import Counter
import numpy as np

# A stud is a stray speckle if fewer than this many of its (up to 8) neighbors
# share its color. 1 means "only snap fully-isolated studs" (zero same-color
# neighbors). Verified against thin features: threshold 2 erased 1-stud-tall
# lines (glasses frames, lips); threshold 1 preserves them while still removing
# the scattered single-stud flecks. See PIPELINE.md "Stage 3.5".
MIN_SAME_NEIGHBORS = 1

# A stud is a color outlier if it differs from its dominant neighbor by more than
# this perceptual (CIE 2000) distance and has at most OUTLIER_MAX_SUPPORT same-color
# neighbors. Catches lone vivid mismatches (a red stud among skin tones) that the
# count-based rule keeps because they aren't fully isolated. ~25 ΔE ≈ clearly a
# different color. See PIPELINE.md "Stage 3.5".
OUTLIER_DELTA_E = 25.0
OUTLIER_MAX_SUPPORT = 2


def clean_grid(grid: np.ndarray, palette,
               min_same_neighbors: int = MIN_SAME_NEIGHBORS,
               outlier_delta_e: float = OUTLIER_DELTA_E,
               outlier_max_support: int = OUTLIER_MAX_SUPPORT) -> np.ndarray:
    """Single light cleanup pass over the color-ID grid.

    For each stud, look at its 8-connected neighbors and snap it to the dominant
    neighbor color when either rule fires:

    1. **Isolated speckle** — fewer than `min_same_neighbors` neighbors share its
       color (default: zero same-color neighbors, i.e. fully isolated).
    2. **Perceptual outlier** — it has at most `outlier_max_support` same-color
       neighbors AND is far (ΔE00 > `outlier_delta_e`) from the dominant
       neighbor color. This catches a lone vivid mismatch (a red stud in a
       cheek) while preserving genuine thin features, which are close in color
       to their surroundings.

    Runs as one pass over a copy so replacements don't cascade within the pass.
    """
    grid = np.asarray(grid)
    rows, cols = grid.shape
    result = grid.copy()

    for r in range(rows):
        for c in range(cols):
            own = int(grid[r, c])
            neighbors = [int(grid[r + dr, c + dc])
                         for dr in (-1, 0, 1) for dc in (-1, 0, 1)
                         if (dr or dc) and 0 <= r + dr < rows and 0 <= c + dc < cols]
            if not neighbors:
                continue

            dominant, _ = Counter(neighbors).most_common(1)[0]
            if dominant == own:
                continue

            support = sum(1 for n in neighbors if n == own)
            if support < min_same_neighbors:
                result[r, c] = dominant                      # isolated speckle
            elif (support <= outlier_max_support
                  and palette.delta_e(own, dominant) > outlier_delta_e):
                result[r, c] = dominant                      # perceptual outlier

    return result
