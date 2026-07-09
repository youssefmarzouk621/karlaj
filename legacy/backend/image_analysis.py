from __future__ import annotations

import cv2
import numpy as np

# Fraction of the image (each edge) sampled as the "border ring" — used to judge
# whether the backdrop is a neutral, uniform studio wall.
BORDER_FRAC = 0.08


def _border_ring(arr: np.ndarray) -> np.ndarray:
    """Return the pixels in a frame around the image edges, flattened to (N, 3)."""
    h, w = arr.shape[:2]
    b = max(1, int(round(min(h, w) * BORDER_FRAC)))
    top, bot = arr[:b, :], arr[-b:, :]
    left, right = arr[b:-b, :b], arr[b:-b, -b:]
    return np.concatenate([p.reshape(-1, 3) for p in (top, bot, left, right)], axis=0)


def analyze_image(arr: np.ndarray) -> dict:
    """Measure an (H, W, 3) RGB uint8 image and return normalized metrics in [0,1]
    (except aspect_ratio) that drive filter selection. See filter_profiles.py."""
    h, w = arr.shape[:2]
    f = arr.astype(np.float32)
    r, g, b = f[..., 0], f[..., 1], f[..., 2]

    # --- Colorfulness (Hasler & Susstrunk, 2003), normalized to ~[0,1] ---
    rg = r - g
    yb = 0.5 * (r + g) - b
    colorfulness = (np.sqrt(rg.std() ** 2 + yb.std() ** 2)
                    + 0.3 * np.sqrt(rg.mean() ** 2 + yb.mean() ** 2))
    colorfulness = float(min(colorfulness / 110.0, 1.0))

    # --- Busyness: density of Canny edges ---
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    edges = cv2.Canny(gray, 60, 160)
    busyness = float((edges > 0).mean())

    # --- Contrast & brightness from luminance percentiles ---
    lum = gray.astype(np.float32)
    p5, p95 = np.percentile(lum, [5, 95])
    contrast = float((p95 - p5) / 255.0)
    brightness = float(lum.mean() / 255.0)

    # --- Saturation: overall (drives the boost knob) and border-only (backdrop) ---
    hsv = cv2.cvtColor(arr, cv2.COLOR_RGB2HSV)
    mean_saturation = float(hsv[..., 1].mean() / 255.0)
    ring = _border_ring(arr)
    ring_hsv = cv2.cvtColor(ring.reshape(-1, 1, 3).astype(np.uint8),
                            cv2.COLOR_RGB2HSV).reshape(-1, 3)
    border_saturation = float(ring_hsv[:, 1].mean() / 255.0)

    return {
        "colorfulness": colorfulness,
        "busyness": busyness,
        "contrast": contrast,
        "brightness": brightness,
        "mean_saturation": mean_saturation,
        "border_saturation": border_saturation,
        "aspect_ratio": w / h,
    }
