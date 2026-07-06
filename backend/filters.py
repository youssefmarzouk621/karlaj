from __future__ import annotations

import cv2
import numpy as np

from background import unify_background  # re-exported so profiles can reference it


def mean_shift(arr: np.ndarray, sp: int = 19, sr: int = 30) -> np.ndarray:
    """Edge-preserving mean-shift: flattens noise/gradients, keeps strong edges.

    This is the single "color quantize" pre-step: it collapses fine texture into
    flat regions so the palette match produces coherent stud blocks instead of
    speckle. `sr` (color radius) is the only real knob — bigger = more merging.
    """
    bgr = cv2.cvtColor(arr, cv2.COLOR_RGB2BGR)
    flat = cv2.pyrMeanShiftFiltering(bgr, sp=sp, sr=sr)
    return cv2.cvtColor(flat, cv2.COLOR_BGR2RGB)


def tone_lift(arr: np.ndarray, gamma: float = 0.8) -> np.ndarray:
    """Gentle *global* exposure lift: gamma on the LAB lightness channel.

    Replaces the old CLAHE step. CLAHE is *local* contrast — at low stud counts
    its per-tile equalization overshot into harsh, distorted faces (blown cheek
    patches, crushed eye sockets). A global gamma brightens a dark/low-key image
    smoothly, preserves the tonal order of every pixel, and cannot introduce
    local artifacts. gamma < 1 brightens; 1.0 is a no-op.
    """
    lab = cv2.cvtColor(arr, cv2.COLOR_RGB2LAB)
    lut = ((np.linspace(0.0, 1.0, 256) ** gamma) * 255.0).astype(np.uint8)
    lab[..., 0] = cv2.LUT(lab[..., 0], lut)
    return cv2.cvtColor(lab, cv2.COLOR_LAB2RGB)


# Dispatch table: profile step names -> filter functions.
_FILTERS = {
    "unify_background": unify_background,
    "mean_shift": mean_shift,
    "tone_lift": tone_lift,
}


def apply_step(arr: np.ndarray, name: str, params: dict) -> np.ndarray:
    fn = _FILTERS.get(name)
    if fn is None:
        raise ValueError(f"unknown filter step: {name!r}")
    return fn(arr, **params)
