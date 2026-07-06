import json
import numpy as np
from pathlib import Path
from colour import delta_E

DATA_DIR = Path(__file__).parent / "data"

# How strongly a near-neutral source pixel is pushed toward a neutral LEGO color.
# Without it, a faintly-tinted grey (e.g. a night stadium) can be perceptually
# closest to a saturated color (Medium Lavender) and snap to a false vivid blob.
# Only penalizes picking a *more saturated* palette color than the pixel itself,
# so genuinely colorful pixels are unaffected.
#
# Keep this SMALL. Downsampling to a low stud count (48) averages colorful
# detail into soft, desaturated pixels — at 0.6 those pixels (e.g. pink flowers
# averaged with foliage) were shoved all the way to grey and a whole scene
# collapsed into grey mush. 0.25 still keeps faint-tinted greys neutral (the
# messi purple-blob fix) while letting soft pinks/greens stay colorful.
CHROMA_BIAS = 0.25


def _rgb_to_lab(rgb_array: np.ndarray) -> np.ndarray:
    from colour import XYZ_to_Lab, sRGB_to_XYZ
    rgb_norm = rgb_array / 255.0
    xyz = sRGB_to_XYZ(rgb_norm)
    return XYZ_to_Lab(xyz)


class LegoPalette:
    def __init__(self):
        with open(DATA_DIR / "lego_colors.json") as f:
            self.colors = json.load(f)

        self.rgb_array = np.array([c["rgb"] for c in self.colors], dtype=np.float64)
        self.lab_array = _rgb_to_lab(self.rgb_array)
        self.chroma_array = np.sqrt(self.lab_array[:, 1] ** 2 + self.lab_array[:, 2] ** 2)
        self.ids = np.array([c["id"] for c in self.colors], dtype=np.int32)
        self._id_to_color = {c["id"]: c for c in self.colors}
        self._id_to_index = {c["id"]: i for i, c in enumerate(self.colors)}
        # Pairwise perceptual distance between every pair of palette colors,
        # precomputed once so grid cleanup can look up ΔE by color id in O(1).
        self._deltaE = delta_E(self.lab_array[:, None, :], self.lab_array[None, :, :],
                               method="CIE 2000")

    def find_nearest(self, rgb: np.ndarray) -> dict:
        pixel_lab = _rgb_to_lab(rgb.astype(np.float64))
        distances = delta_E(pixel_lab, self.lab_array, method="CIE 2000")
        idx = int(np.argmin(distances))
        return self.colors[idx]

    def delta_e(self, id_a: int, id_b: int) -> float:
        """Perceptual (CIE 2000) distance between two palette colors, by id."""
        return float(self._deltaE[self._id_to_index[id_a], self._id_to_index[id_b]])

    def match_image(self, pixels: np.ndarray, chroma_bias: float = CHROMA_BIAS) -> np.ndarray:
        """Map an (H, W, 3) RGB image to LEGO color IDs. Returns (H, W) array of color IDs.

        Fully vectorized: every pixel's ΔE to all palette colors is computed in one
        broadcast call, then argmin picks the nearest — ~10-100x faster than looping.
        A chroma bias nudges near-neutral pixels away from saturated palette colors
        so faint grey tints don't snap to false vivid blobs.
        """
        h, w, _ = pixels.shape
        flat_lab = _rgb_to_lab(pixels.reshape(-1, 3).astype(np.float64))
        # (N, 1, 3) vs (1, K, 3) -> (N, K) perceptual distances
        distances = delta_E(flat_lab[:, None, :], self.lab_array[None, :, :],
                            method="CIE 2000")
        if chroma_bias:
            src_chroma = np.sqrt(flat_lab[:, 1] ** 2 + flat_lab[:, 2] ** 2)  # (N,)
            # penalize only palette colors more saturated than the source pixel
            penalty = np.clip(self.chroma_array[None, :] - src_chroma[:, None], 0, None)
            distances = distances + chroma_bias * penalty
        nearest = np.argmin(distances, axis=1)
        return self.ids[nearest].reshape(h, w)

    def get_color(self, color_id: int) -> dict:
        return self._id_to_color[color_id]

    def get_rgb(self, color_id: int) -> list[int]:
        return self._id_to_color[color_id]["rgb"]
