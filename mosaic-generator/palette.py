"""LEGO brick color palette + fast nearest-color matching.

The palette and matching are a faithful port of `brickmos`: the same 33
BrickLink plate colors and the same plain **Euclidean-RGB nearest-color** rule.
The only change is that matching is **vectorized with numpy** instead of a
per-pixel Python double loop, so it is genuinely fast (milliseconds even at
96x96) while producing pixel-identical results.

Colors: BrickLink 1x1 plate (part 3024). Find more at
https://www.bricklink.com/catalogColors.asp
"""

from __future__ import annotations

import numpy as np

# rgb, BrickLink color name, BrickLink color id, BrickLink part id (1x1 plate)
BRICK_COLORS: list[dict] = [
    {"rgb": (255, 255, 255), "name": "White",             "color_id": 1,   "part_id": "3024"},
    {"rgb": (175, 181, 199), "name": "LightBluishGray",   "color_id": 86,  "part_id": "3024"},
    {"rgb": (89, 93, 96),    "name": "DarkBluishGray",    "color_id": 85,  "part_id": "3024"},
    {"rgb": (33, 33, 33),    "name": "Black",             "color_id": 11,  "part_id": "3024"},
    {"rgb": (106, 14, 21),   "name": "DarkRed",           "color_id": 59,  "part_id": "3024"},
    {"rgb": (179, 0, 6),     "name": "Red",               "color_id": 5,   "part_id": "3024"},
    {"rgb": (88, 42, 18),    "name": "ReddishBrown",      "color_id": 88,  "part_id": "3024"},
    {"rgb": (222, 198, 156), "name": "Tan",               "color_id": 2,   "part_id": "3024"},
    {"rgb": (144, 116, 80),  "name": "DarkTan",           "color_id": 69,  "part_id": "3024"},
    {"rgb": (227, 160, 91),  "name": "MediumNougat",      "color_id": 150, "part_id": "3024"},
    {"rgb": (179, 84, 8),    "name": "DarkOrange",        "color_id": 68,  "part_id": "3024"},
    {"rgb": (255, 126, 20),  "name": "Orange",            "color_id": 4,   "part_id": "3024"},
    {"rgb": (247, 186, 48),  "name": "BrightLightOrange", "color_id": 110, "part_id": "3024"},
    {"rgb": (247, 209, 23),  "name": "Yellow",            "color_id": 3,   "part_id": "3024"},
    {"rgb": (241, 225, 103), "name": "BrightLightYellow", "color_id": 103, "part_id": "3024"},
    {"rgb": (223, 238, 165), "name": "YellowishGreen",    "color_id": 158, "part_id": "3024"},
    {"rgb": (166, 202, 85),  "name": "Lime",              "color_id": 34,  "part_id": "3024"},
    {"rgb": (127, 143, 86),  "name": "OliveGreen",        "color_id": 155, "part_id": "3024"},
    {"rgb": (46, 85, 67),    "name": "DarkGreen",         "color_id": 80,  "part_id": "3024"},
    {"rgb": (0, 100, 46),    "name": "Green",             "color_id": 6,   "part_id": "3024"},
    {"rgb": (16, 203, 49),   "name": "BrightGreen",       "color_id": 36,  "part_id": "3024"},
    {"rgb": (0, 138, 128),   "name": "DarkTurquoise",     "color_id": 39,  "part_id": "3024"},
    {"rgb": (20, 48, 68),    "name": "DarkBlue",          "color_id": 63,  "part_id": "3024"},
    {"rgb": (0, 87, 166),    "name": "Blue",              "color_id": 7,   "part_id": "3024"},
    {"rgb": (73, 151, 250),  "name": "DarkAzure",         "color_id": 153, "part_id": "3024"},
    {"rgb": (95, 189, 247),  "name": "MediumAzure",       "color_id": 156, "part_id": "3024"},
    {"rgb": (97, 175, 255),  "name": "MediumBlue",        "color_id": 42,  "part_id": "3024"},
    {"rgb": (164, 194, 230), "name": "BrightLightBlue",   "color_id": 105, "part_id": "3024"},
    {"rgb": (90, 113, 132),  "name": "SandBlue",          "color_id": 55,  "part_id": "3024"},
    {"rgb": (95, 38, 131),   "name": "DarkPurple",        "color_id": 89,  "part_id": "3024"},
    {"rgb": (136, 94, 158),  "name": "MediumLavender",    "color_id": 157, "part_id": "3024"},
    {"rgb": (200, 112, 128), "name": "DarkPink",          "color_id": 47,  "part_id": "3024"},
    {"rgb": (255, 187, 255), "name": "BrightPink",        "color_id": 104, "part_id": "3024"},
]


class Palette:
    """A brick-color palette with a vectorized nearest-color matcher."""

    def __init__(self, colors: list[dict] = BRICK_COLORS):
        self.colors = colors
        self._rgb = np.array([c["rgb"] for c in colors], dtype=np.int32)  # (N, 3)

    def __len__(self) -> int:
        return len(self.colors)

    def color(self, index: int) -> dict:
        return self.colors[index]

    def match(self, rgb_image: np.ndarray) -> np.ndarray:
        """Map an (H, W, 3) RGB image to palette indices via nearest Euclidean RGB.

        Vectorized: one broadcast squared-distance computation + argmin. Squared
        distance shares its argmin with true Euclidean distance, so this is
        identical to brickmos's per-pixel `min(sqrt(...))` (ties resolve to the
        first/lowest palette index in both).
        """
        h, w = rgb_image.shape[:2]
        flat = rgb_image.reshape(-1, 3).astype(np.int32)          # (P, 3)
        # (P, 1, 3) - (1, N, 3) -> (P, N, 3); squared-sum over channels -> (P, N)
        diff = flat[:, None, :] - self._rgb[None, :, :]
        dist_sq = np.einsum("pnc,pnc->pn", diff, diff)
        return np.argmin(dist_sq, axis=1).reshape(h, w)           # (H, W) indices
