"""Stage 4b — black where the picture is black: dark tones and ink lines.

Why this exists
---------------
Side by side with a hand-built GTA VI mosaic (80x128 round plates, see
`optimization/reference/`), our colors were nearly identical; the difference
was black. The reference renders

- every dark area — panel gutters, the logo frame, the border — as **black**,
  where we picked the nearest dark *hue*: the gutters' dark purple landed on
  Dark Blue, which was our single most-used brick (1,510 of 10,240 studs);
- the artwork's **ink lines** — letter outlines, figure contours — as
  continuous one-stud black lines. They are thinner than a stud, so the area
  average in stage 4 dissolves them into whatever surrounds them.

Two steps, after quantization and before tiling:

1. **Darks to black.** A dark stud (averaged lightness below `DARK_L`)
   becomes the palette's black when black matches it nearly as well as the
   brick it got (within `BLACK_RATIO`). The GTA gutters are dark purple; the
   nearest brick was Dark Blue, a wrong hue black matches almost as well
   (ratio ~1.10), so they turn black. A dark stud whose brick is a *faithful*
   hue keeps it: Messi's dark-brown hair (ratio ~1.5) stays brown, which is
   what separates it from the near-black background — lightness alone can't,
   both sit at L* 5-7.
2. **Ink lines.** A morphological black-hat on lightness, at working
   resolution, finds thin features darker than their surroundings — exactly
   the linework averaging destroys. Each stud gets its ink coverage; studs
   over `STRONG` seed lines, studs over `WEAK` extend them (hysteresis, so a
   line stays continuous), and two gates keep it to *lines*:
   - components smaller than `MIN_LINE_STUDS` are dropped (specks, eye
     highlights, JPEG noise);
   - where ink is dense over a neighbourhood (`MAX_DENSITY`), it is texture —
     hair, foliage, a crowd — not an outline, and is left to stage 4.

Ink studs are returned as a `protect` mask so `bricks._despeckle_isolated`
keeps one-stud line pieces.

Cost: tens of milliseconds at 128 studs.
"""

from __future__ import annotations

import cv2
import numpy as np

from palette import Palette
from preprocess import to_lab

# Toggles (the optimization harness flips these for before/after).
DARKS_TO_BLACK = True
INK_LINES = True

# A stud darker than this (CIELAB L*, 0-100) may become black...
DARK_L = 22.0
# ...when its distance to black is within this factor of its distance to the
# brick it was matched to (dE76, averaged color).
BLACK_RATIO = 1.2

# A palette color counts as "black" when it is this dark and this neutral.
BLACK_MAX_L = 20.0
BLACK_MAX_CHROMA = 20.0

# Ink pixels: at least INK_CONTRAST darker than their surroundings (black-hat,
# 8-bit L) and darker than INK_MAX_L themselves.
INK_CONTRAST = 55
INK_MAX_L = 80
# Black-hat kernel width, in studs: features thinner than this count as lines.
INK_KERNEL_STUDS = 1.2
# Stud ink coverage: seeds a line / extends a line.
STRONG = 0.30
WEAK = 0.15
# Gates.
MIN_LINE_STUDS = 5
DENSITY_WINDOW = 5
MAX_DENSITY = 0.45


def black_index(palette: Palette) -> int | None:
    """The palette's black: its darkest near-neutral color, if it has one."""
    lab = palette.lab
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    ok = (lab[:, 0] <= BLACK_MAX_L) & (chroma <= BLACK_MAX_CHROMA)
    if not ok.any():
        return None
    candidates = np.nonzero(ok)[0]
    return int(candidates[np.argmin(lab[candidates, 0])])


def dark_studs(rgb_small: np.ndarray, index_grid: np.ndarray, palette: Palette,
               black: int) -> np.ndarray:
    """(h, w) bool — dark studs that black renders about as faithfully as
    the brick they were matched to."""
    h, w = rgb_small.shape[:2]
    lab = to_lab(rgb_small).reshape(h, w, 3)
    to_matched = np.linalg.norm(lab - palette.lab[index_grid], axis=2)
    to_black = np.linalg.norm(lab - palette.lab[black], axis=2)
    return (lab[..., 0] < DARK_L) & (to_black <= BLACK_RATIO * to_matched)


def ink_studs(bgr: np.ndarray, width: int, height: int) -> np.ndarray:
    """(height, width) bool — studs on a continuous dark line in the source."""
    L = cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB)[:, :, 0]
    px_per_stud = bgr.shape[1] / width
    k = max(3, int(round(px_per_stud * INK_KERNEL_STUDS)) | 1)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    blackhat = cv2.morphologyEx(L, cv2.MORPH_BLACKHAT, kernel)
    ink = ((blackhat > INK_CONTRAST) & (L < INK_MAX_L)).astype(np.float32)
    coverage = cv2.resize(ink, (width, height), interpolation=cv2.INTER_AREA)

    weak = coverage >= WEAK
    # Texture gate: dense ink over a neighbourhood is hair/foliage, not a line.
    density = cv2.blur(weak.astype(np.float32), (DENSITY_WINDOW, DENSITY_WINDOW))
    weak &= density <= MAX_DENSITY
    strong = weak & (coverage >= STRONG)

    # Hysteresis: keep weak studs connected to a strong one; drop small specks.
    n, labels, stats, _ = cv2.connectedComponentsWithStats(weak.astype(np.uint8), connectivity=8)
    seeded = np.zeros(n, dtype=bool)
    seeded[np.unique(labels[strong])] = True
    big = stats[:, cv2.CC_STAT_AREA] >= MIN_LINE_STUDS
    keep = seeded & big
    keep[0] = False  # background label
    return keep[labels]


def apply(bgr: np.ndarray, index_grid: np.ndarray, rgb_small: np.ndarray,
          palette: Palette) -> tuple[np.ndarray, np.ndarray | None, dict]:
    """Run both steps. Returns (grid, protect_mask, stats); the grid comes back
    unchanged when the palette has no black."""
    black = black_index(palette)
    if black is None:
        return index_grid, None, {"skipped": "palette has no black"}
    height, width = index_grid.shape
    out = np.asarray(index_grid).copy()
    stats: dict = {}

    if DARKS_TO_BLACK:
        dark = dark_studs(rgb_small, out, palette, black)
        stats["dark_studs"] = int((dark & (out != black)).sum())
        out[dark] = black

    ink = np.zeros_like(out, dtype=bool)
    if INK_LINES:
        ink = ink_studs(bgr, width, height)
        stats["ink_studs"] = int((ink & (out != black)).sum())
        out[ink] = black

    return out, (ink if ink.any() else None), stats
