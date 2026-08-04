"""Image -> stud grid.

Two conversion profiles (see `preprocess.py` for the reasoning):

    legacy:     decode -> center-crop -> resize (INTER_LINEAR) -> nearest RGB color
    perceptual: decode -> center-crop -> bilateral -> resize (INTER_AREA)
                -> tone-compress -> nearest CIELAB color

`legacy` is brickmos's original conversion, kept intact and reachable. Its "no
preprocessing" stance is right *when the palette covers the image's colors* —
the rich shading comes from keeping the natural variation of a linearly
downsampled image. It breaks down on a palette with a gamut hole (no white, no
black, no light neutral), where unconditioned nearest-color sends whole regions
to the wrong hue. `perceptual` is the default for that reason.
"""

from __future__ import annotations

import cv2
import numpy as np

from palette import Palette
from preprocess import DEFAULT_PROFILE, LEGACY, downsample_by_region

# Working resolution the whole pipeline runs at (longest side, pixels), and the
# floor on source pixels per stud that overrides it for large stud grids.
WORK_MAX = 1024
MIN_PIXELS_PER_STUD = 10


def decode_image(image_bytes: bytes) -> np.ndarray:
    """Decode encoded (JPEG/PNG/...) bytes into a cv2 BGR array, no disk touch."""
    buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image data; unsupported or corrupt image file.")
    return image


def center_crop_to_ratio(img: np.ndarray, target_width: int, target_height: int) -> np.ndarray:
    """Center-crop a BGR array to the target aspect ratio so it isn't stretched
    when resized down to the stud grid."""
    target_ratio = target_width / target_height
    height, width = img.shape[:2]
    img_ratio = width / height

    if img_ratio > target_ratio:
        new_width = int(height * target_ratio)
        left = (width - new_width) // 2
        return img[:, left:left + new_width]
    if img_ratio < target_ratio:
        new_height = int(width / target_ratio)
        top = (height - new_height) // 2
        return img[top:top + new_height, :]
    return img


def prepare_source(image_bytes: bytes, width: int, height: int,
                   cap_resolution: bool = True) -> np.ndarray:
    """Decode, center-crop to the target aspect ratio, and cap the resolution.

    Everything downstream (quantization *and* attention detection) works from
    this one image, so the cap is applied once, here.

    The cap matters: a 17MP phone photo bilateral-filtered at full resolution
    took **7 seconds**, in a service whose whole selling point is generating a
    mosaic in milliseconds. Nothing downstream can use that detail — at the
    96-stud maximum, `WORK_MAX` still leaves ~10 source pixels per stud, which
    is more than an area average needs. Cropping first and scaling second keeps
    the framing identical.

    Pass `cap_resolution=False` for the `legacy` profile: it exists to reproduce
    brickmos's output exactly, and resizing from a capped image samples
    differently than resizing from the full one.
    """
    cropped = center_crop_to_ratio(decode_image(image_bytes), width, height)
    if not cap_resolution:
        return cropped
    longest = max(cropped.shape[:2])
    target = max(WORK_MAX, max(width, height) * MIN_PIXELS_PER_STUD)
    if longest <= target:
        return cropped
    scale = target / longest
    return cv2.resize(cropped, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)


def quantize(bgr: np.ndarray, palette: Palette, width: int, height: int,
             profile: str = DEFAULT_PROFILE,
             priority: np.ndarray | None = None) -> tuple[np.ndarray, np.ndarray]:
    """Cropped source -> (index_grid, rgb_small).

    `profile` selects the conversion:

    - `"legacy"`     — the original brickmos-faithful path (INTER_LINEAR resize,
      Euclidean-RGB match, no conditioning). Kept so the change is reversible
      and A/B-able, since preprocessing is exactly what flattened the older
      `backend/` pipeline.
    - `"perceptual"` — region-aware downsampling and CIELAB matching with tone
      compression. See `preprocess.py`.

    `priority` is the per-stud attention map; each region is downsampled with
    the treatment that suits it (see `preprocess.downsample_by_region`).

    The downsampled RGB is returned alongside the indices because later stages
    need the true colors, not the quantized ones.
    """
    if profile == LEGACY:
        small = cv2.resize(bgr, (width, height), interpolation=cv2.INTER_LINEAR)
        rgb = np.ascontiguousarray(small[:, :, ::-1])   # cv2 BGR -> RGB
        return palette.match(rgb), rgb

    small = downsample_by_region(bgr, width, height, priority)
    rgb = np.ascontiguousarray(small[:, :, ::-1])
    return palette.match_perceptual(rgb), rgb


def image_to_index_grid(image_bytes: bytes, palette: Palette, width: int, height: int,
                        profile: str = DEFAULT_PROFILE) -> tuple[np.ndarray, np.ndarray]:
    """Convenience wrapper: bytes -> (index_grid, rgb_small), no attention.

    Used by tooling and by the legacy path. The service itself calls
    `prepare_source` / `quantize` directly so the crop is shared with detection.
    """
    source = prepare_source(image_bytes, width, height,
                            cap_resolution=(profile != LEGACY))
    return quantize(source, palette, width, height, profile)
