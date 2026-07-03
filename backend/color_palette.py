import json
import numpy as np
from pathlib import Path
from colour import delta_E

DATA_DIR = Path(__file__).parent / "data"


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
        self._id_to_color = {c["id"]: c for c in self.colors}

    def find_nearest(self, rgb: np.ndarray) -> dict:
        pixel_lab = _rgb_to_lab(rgb.astype(np.float64))
        distances = delta_E(pixel_lab, self.lab_array, method="CIE 2000")
        idx = int(np.argmin(distances))
        return self.colors[idx]

    def match_image(self, pixels: np.ndarray) -> np.ndarray:
        """Map an (H, W, 3) RGB image to LEGO color IDs. Returns (H, W) array of color IDs."""
        h, w, _ = pixels.shape
        flat = pixels.reshape(-1, 3).astype(np.float64)
        flat_lab = _rgb_to_lab(flat)

        result_ids = np.empty(flat.shape[0], dtype=np.int32)
        for i in range(flat.shape[0]):
            distances = delta_E(flat_lab[i], self.lab_array, method="CIE 2000")
            result_ids[i] = self.colors[int(np.argmin(distances))]["id"]

        return result_ids.reshape(h, w)

    def get_color(self, color_id: int) -> dict:
        return self._id_to_color[color_id]

    def get_rgb(self, color_id: int) -> list[int]:
        return self._id_to_color[color_id]["rgb"]
