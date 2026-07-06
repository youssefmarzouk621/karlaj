from __future__ import annotations

import numpy as np

from filters import apply_step

# --- Routing thresholds (calibrated at the fixed working resolution, see
# processor.WORK_SIZE, against ktyb.jpg / ala.jpeg vs wedding.JPG / messi.jpg) ---
# ala   : colorfulness=0.22 busyness=0.04 border_saturation=0.09  (studio portrait)
# ktyb  : colorfulness=0.24 busyness=0.03 border_saturation=0.13  (studio portrait)
# messi : colorfulness=0.34 busyness=0.06 border_saturation=0.26  (busy scene)
# wedding: colorfulness=0.39 busyness=0.05 border_saturation=0.31 (busy scene)
STUDIO_MAX_COLORFULNESS = 0.30
STUDIO_MAX_BUSYNESS = 0.06
STUDIO_MAX_BORDER_SAT = 0.20
SCENE_MIN_COLORFULNESS = 0.33
SCENE_MIN_BUSYNESS = 0.07
SCENE_MIN_BORDER_SAT = 0.25

# A dull / low-key image (low global contrast) gets a gentle global tone lift
# before anything else — this rescues dark portraits. High-contrast images (a
# night stadium shot) are left alone so their drama survives.
TONE_MAX_CONTRAST = 0.52

# tone_lift gamma is derived from brightness: darker image -> stronger lift,
# clamped so the lift always stays gentle (gamma 1.0 = no-op).
TONE_MIN_GAMMA = 0.70

# mean_shift color radius: one fixed, moderate value for every profile. It runs
# at the fixed working resolution (processor.WORK_SIZE), so its effect no longer
# depends on the requested stud count.
MEAN_SHIFT_SP = 19
MEAN_SHIFT_SR = 30


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


def select_profile(m: dict) -> str:
    """Route image metrics to a profile name."""
    neutral_backdrop = m["border_saturation"] < STUDIO_MAX_BORDER_SAT
    simple = m["colorfulness"] < STUDIO_MAX_COLORFULNESS and m["busyness"] < STUDIO_MAX_BUSYNESS
    if neutral_backdrop and simple:
        return "studio_portrait"

    colorful_or_busy = (m["colorfulness"] > SCENE_MIN_COLORFULNESS
                        or m["busyness"] > SCENE_MIN_BUSYNESS
                        or m["border_saturation"] > SCENE_MIN_BORDER_SAT)
    if colorful_or_busy:
        return "busy_scene"

    return "default"


def build_recipe(m: dict) -> dict:
    """Build the ordered filter recipe for an image from its metrics.

    Returns {"profile": name, "steps": [(step_name, params), ...]}.

    The stack is deliberately small and orthogonal:
      1. tone_lift        — optional global exposure fix (dull/low-key images only)
      2. unify_background — studio portraits only (the shadow-banding fix)
      3. mean_shift       — the one flattening/quantize-prep step, fixed params

    Color handling (keeping flowers vivid, keeping neutrals neutral) lives in a
    single place: the chroma bias inside color_palette.match_image. Grid cleanup
    runs later, post-quantization.
    """
    name = select_profile(m)
    steps = []

    # Optional first step: rescue a dull/low-key image with a *global* tone lift.
    # Darker images get a stronger lift (lower gamma), always gently clamped.
    if m["contrast"] < TONE_MAX_CONTRAST:
        gamma = _clamp(0.45 + m["brightness"], TONE_MIN_GAMMA, 1.0)
        steps.append(("tone_lift", {"gamma": round(gamma, 3)}))

    if name == "studio_portrait":
        # Neutral backdrop -> repaint it one color so a wall shadow can't split
        # into two LEGO greys with a hard seam.
        steps.append(("unify_background", {}))

    # Every profile ends with one moderate edge-preserving flatten.
    steps.append(("mean_shift", {"sp": MEAN_SHIFT_SP, "sr": MEAN_SHIFT_SR}))

    return {"profile": name, "steps": steps}


def apply_recipe(arr: np.ndarray, recipe: dict) -> np.ndarray:
    for step_name, params in recipe["steps"]:
        arr = apply_step(arr, step_name, params)
    return arr
