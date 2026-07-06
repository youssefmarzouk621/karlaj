"""Image -> stud grid. A faithful port of brickmos's conversion:

    decode -> center-crop to aspect ratio -> resize (INTER_LINEAR) -> nearest color

There is deliberately **no preprocessing** (no mean-shift / tone / chroma bias).
brickmos's richer shading comes precisely from keeping the natural color
variation of the linearly-downsampled image and letting nearest-color mapping
land on the full palette. The only speed change is the vectorized matcher in
`palette.py`.
"""

from __future__ import annotations

import cv2
import numpy as np

from palette import Palette


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


def image_to_index_grid(image_bytes: bytes, palette: Palette, width: int, height: int) -> np.ndarray:
    """Turn uploaded image bytes into an (height, width) grid of palette indices."""
    bgr = decode_image(image_bytes)
    bgr = center_crop_to_ratio(bgr, width, height)
    small = cv2.resize(bgr, (width, height), interpolation=cv2.INTER_LINEAR)
    rgb = small[:, :, ::-1]                      # cv2 BGR -> RGB
    return palette.match(rgb)                    # (height, width) indices
