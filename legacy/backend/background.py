from __future__ import annotations

import cv2
import numpy as np

# --- Background unification tuning ---
# A shadow/vignette on a plain backdrop is a large, coherent darker region, so it
# survives smoothing and snaps to a second LEGO grey with a hard seam. The robust
# fix is to treat the whole backdrop as ONE region: flood-fill inward from the
# image borders (floating range, so a gentle shadow gradient is walked) and
# repaint it a single color. A saturation/value barrier keeps the flood inside
# the neutral backdrop so it never leaks into the subject (skin, hair, clothing).
# See PIPELINE.md "Stage 2.4".
FLOOD_TOLERANCE = 14      # per-step color tolerance for the floating-range fill
SAT_BARRIER = 60          # HSV saturation above this = subject, blocks the fill
VAL_BARRIER = 60          # HSV value below this = dark object (hoodie), blocks the fill
MIN_BG_FRACTION = 0.05    # if less than this is found to be background, do nothing


def unify_background(rgb: np.ndarray,
                     tolerance: int = FLOOD_TOLERANCE,
                     sat_barrier: int = SAT_BARRIER,
                     val_barrier: int = VAL_BARRIER,
                     min_bg_fraction: float = MIN_BG_FRACTION) -> np.ndarray:
    """Repaint a border-connected neutral backdrop as a single flat color.

    Operates on an (H, W, 3) RGB uint8 array. Safe no-op when the backdrop isn't
    neutral or border-connected (e.g. a colorful or full-bleed background) — the
    barriers simply block the fill and too little background is found.
    """
    h, w = rgb.shape[:2]
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    sat, val = hsv[:, :, 1], hsv[:, :, 2]

    # Colorful or dark pixels are the subject — barrier the flood out of them.
    barrier = (sat > sat_barrier) | (val < val_barrier)
    mask = np.zeros((h + 2, w + 2), np.uint8)
    mask[1:-1, 1:-1][barrier] = 1                       # non-zero mask blocks the fill

    flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)   # 4-connected, floating range
    canvas = rgb.copy()

    # Seed points spread along all four borders so a backdrop split by the
    # subject (e.g. visible on both left and right) is still fully reached.
    step = max(1, min(h, w) // 16)
    seeds = []
    for x in range(0, w, step):
        seeds += [(x, 0), (x, h - 1)]
    for y in range(0, h, step):
        seeds += [(0, y), (w - 1, y)]

    for sx, sy in seeds:
        if mask[sy + 1, sx + 1] == 0:                  # skip seeds already barriered
            cv2.floodFill(canvas, mask, (sx, sy), 0,
                          (tolerance,) * 3, (tolerance,) * 3, flags)

    bg = mask[1:-1, 1:-1] == 255
    if bg.mean() < min_bg_fraction:
        return rgb                                      # not enough backdrop — no-op

    out = rgb.copy()
    out[bg] = np.median(rgb[bg], axis=0)
    return out
