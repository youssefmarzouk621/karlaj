"""Image conditioning before quantization, and the tone mapping that fits an
image into what a given palette can actually express.

Why this exists
---------------
The original pipeline did no preprocessing on purpose: brickmos's rich shading
comes from linearly downsampling and letting nearest-color land across a broad,
well-distributed palette. That reasoning holds only while the palette actually
covers the image's colors. It does not hold for a supplier range with a hole in
it — the PX range carries no white, no black and no light neutral, so a white
studio photo rendered lavender and white poster text vanished into a beige
background.

Two conditioning steps address that without flattening real shading:

1. `smooth_for_quantization` — edge-preserving (bilateral) smoothing at source
   resolution, then an area-average downsample. Flat fields stop speckling
   across near-equidistant bricks; edges stay sharp because the filter is
   edge-aware. This replaces the plain INTER_LINEAR resize, whose point-ish
   sampling aliased thin strokes into noise.

2. `compress_into_palette_range` — when the palette's lightness range is
   narrower than the image's, squeeze the image into it rather than letting
   nearest-color clip everything past both ends onto the two extreme bricks.

The one rule that matters in (2): **compress only, never expand.** An earlier
version rescaled the image's 1–99 percentile band onto the palette's full
range in both directions. On a low-contrast image (a high-key wedding photo,
where nearly every pixel is near-white) that is a ~2.3x gain, and it amplified
JPEG noise and a faint color cast into blue and green bricks — visibly worse
than doing nothing. Expanding contrast is not this function's job.
"""

from __future__ import annotations

import cv2
import numpy as np

from attention import SILHOUETTE, TEXT

# Profiles: "legacy" reproduces the original brickmos-faithful path exactly,
# "perceptual" is the conditioned path described above.
LEGACY = "legacy"
PERCEPTUAL = "perceptual"
DEFAULT_PROFILE = PERCEPTUAL

# Below this palette/image lightness-range coverage, tone compression engages.
# At/above it the palette spans essentially the whole image and remapping would
# only add error.
COVERAGE_THRESHOLD = 0.92


def to_lab(rgb: np.ndarray) -> np.ndarray:
    """(..., 3) uint8 RGB -> float64 Lab, L in 0..100, a/b in about -128..127.

    cv2's 8-bit Lab is scaled (L*255/100, a+128, b+128); undo that so the
    numbers are real CIELAB and distances are interpretable as dE76.
    """
    flat = np.ascontiguousarray(rgb).reshape(-1, 1, 3).astype(np.uint8)
    lab = cv2.cvtColor(flat, cv2.COLOR_RGB2LAB).reshape(-1, 3).astype(np.float64)
    lab[:, 0] *= 100.0 / 255.0
    lab[:, 1:] -= 128.0
    return lab


def smooth_for_quantization(bgr: np.ndarray, width: int, height: int) -> np.ndarray:
    """Edge-preserving smooth at source resolution, then area-average downsample."""
    scale = max(bgr.shape[:2]) / max(width, height)
    # Filter diameter tracks how many source pixels collapse into one stud:
    # smoothing over roughly that neighbourhood removes exactly the detail the
    # downsample cannot represent anyway, and nothing coarser.
    diameter = int(max(5, min(21, scale * 1.5)))
    diameter |= 1  # cv2 wants odd
    smoothed = cv2.bilateralFilter(bgr, d=diameter, sigmaColor=40, sigmaSpace=diameter)
    return cv2.resize(smoothed, (width, height), interpolation=cv2.INTER_AREA)


def sharpen_for_quantization(bgr: np.ndarray, width: int, height: int) -> np.ndarray:
    """Downsample with the fine detail kept, for regions that need to stay legible.

    Area-averaging a 4px letter stroke down to one stud blends it halfway into
    its background; the stud then quantizes to some midtone and the letter
    turns to mush. An unsharp mask before the downsample pushes those edge
    pixels back toward their true extremes, so the stud lands on the letter's
    color or the background's rather than between them.
    """
    blurred = cv2.GaussianBlur(bgr, (0, 0), sigmaX=max(1.0, max(bgr.shape[:2]) / 400))
    sharpened = cv2.addWeighted(bgr, 1.6, blurred, -0.6, 0)
    return cv2.resize(sharpened, (width, height), interpolation=cv2.INTER_AREA)


def downsample_by_region(bgr: np.ndarray, width: int, height: int,
                         priority: np.ndarray | None) -> np.ndarray:
    """Downsample each region with the treatment that suits it, then composite.

    The goals genuinely conflict: smoothing is what stops a flat field
    speckling across near-equidistant bricks, and it is also what destroys thin
    strokes. Applying each where it helps is the whole point of having a
    priority map — this is where the map buys *visible* quality, as opposed to
    the tiler, where it only changes which plates get used.

    Three treatments, because two isn't enough:

    - background — bilateral smoothing, then area-average. Kills speckle.
    - silhouette — plain area-average. A face is not a graphic: sharpening it
      amplifies skin texture and JPEG noise into a rash of stray studs, which
      measured *worse* than leaving it alone. It just must not be smoothed.
    - text       — unsharp mask, then area-average. Lettering is exactly the
      case where pushing edge pixels back to their extremes pays off.
    """
    smooth = smooth_for_quantization(bgr, width, height)
    if priority is None or not priority.any():
        return smooth

    out = smooth
    if (priority == SILHOUETTE).any():
        plain = cv2.resize(bgr, (width, height), interpolation=cv2.INTER_AREA)
        out = np.where((priority == SILHOUETTE)[:, :, None], plain, out)
    if (priority == TEXT).any():
        sharp = sharpen_for_quantization(bgr, width, height)
        out = np.where((priority == TEXT)[:, :, None], sharp, out)
    return out.astype(np.uint8)


def compress_into_palette_range(lab: np.ndarray, palette_lab: np.ndarray) -> np.ndarray:
    """Squeeze the image's lightness into the palette's, when the palette is
    narrower. Returns `lab` untouched when the palette already covers it.

    Chroma (a/b) is deliberately left alone: it is lightness clipping that
    destroys modelling, and scaling chroma toward a gamut this sparse just
    shifts hues.
    """
    lo_img, hi_img = np.percentile(lab[:, 0], [1.0, 99.0])
    lo_pal, hi_pal = float(palette_lab[:, 0].min()), float(palette_lab[:, 0].max())

    img_range = hi_img - lo_img
    pal_range = hi_pal - lo_pal
    if img_range < 1e-6 or pal_range < 1e-6:
        return lab
    if pal_range / img_range >= COVERAGE_THRESHOLD:
        return lab  # palette covers the image; leave it alone

    scale = pal_range / img_range  # < 1 by the check above: compression only
    out = lab.copy()
    out[:, 0] = lo_pal + (out[:, 0] - lo_img) * scale
    return out
