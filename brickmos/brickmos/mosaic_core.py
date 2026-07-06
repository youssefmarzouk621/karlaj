"""Core mosaic generation logic shared between the CLI (`brickify.py`) and the
HTTP upload service (`service.py`).

This module was extracted so the exact same color-matching pipeline can run
against an **in-memory uploaded image** (raw bytes, e.g. from a browser file
upload) in addition to a path on disk. `decode_image()` / `generate_mosaic()`
are the pieces that make that possible.
"""

from __future__ import annotations

import csv
import math
import xml.etree.ElementTree as xmlET

import cv2
import numpy as np

# ===> Data classes


class BrickColor:
    """
    Defines a brick color with all information needed for processing and bricklink export.
    """

    def __init__(self, rgb, color_name, color_id, color_type):
        self.rgb = rgb
        self.colorName = color_name
        self.colorId = color_id
        self.colorType = color_type

    def __str__(self):
        return f"{self.rgb} / {self.colorName} / {self.colorId} / {self.colorType}"


class BrickColorStats:
    """
    Tracks some stats for the corresponding color.
    """

    def __init__(self, brick_color):
        self.brickColor = brick_color
        self.count = 0


# ===> Color handling


def read_colors(color_csv: str) -> list[BrickColor]:
    """
    Reads the color CSV and returns the color definitions.
    Expected CSV-format (with header, integer RGB): red,green,blue;color-name,bricklink-color-id,bricklink-brick-type
    :param color_csv: The CSV content as a string.
    :return: All color definitions read from the file.
    """
    colors_read = []
    csv_reader = csv.reader(color_csv.splitlines(), delimiter=";")
    next(csv_reader)
    for row in csv_reader:
        colors_read.append(
            BrickColor(
                tuple([int(i) for i in row[0].split(sep=",")]),
                row[1].strip(),
                row[2].strip(),
                row[3].strip(),
            )
        )
    return colors_read


def closest_color(rgb: tuple[int, int, int], color_range: list) -> BrickColor:
    """
    Returns the color from the range which is closest to the given one.
    :param rgb: The given color to fine the closest one for.
    :param color_range: The range of possible colors.
    :return: The color closest to the given one.
    """
    # Get rgb values of color while adhering to cv2 BGR representation
    r, g, b = rgb
    r, g, b = float(r), float(g), float(b)
    # Assess euclidean distance of color to all brick colors given
    color_diffs = []
    for color in color_range:
        cr, cg, cb = color.rgb
        cr, cg, cb = float(cr), float(cg), float(cb)
        color_diff = math.sqrt(abs(r - cr) ** 2 + abs(g - cg) ** 2 + abs(b - cb) ** 2)
        color_diffs.append((color_diff, color))
    # Get color closest to the given one and update its stats
    return min(color_diffs, key=lambda x: x[0])[1]


def replace_with_brick_colors(img, brick_colors):
    """
    Replaces all colors in the image with the closest brick colors given.
    :param img: The image to process (mutated in place).
    :param brick_colors: The available brick colors to map onto.
    :return: A tuple of (stats, color_grid) where stats are the collected color
        statistics and color_grid is a list-of-lists holding the BrickColor
        chosen for each pixel/stud (same shape as img).
    """
    stats = {}
    color_grid = [[None] * img.shape[1] for _ in range(img.shape[0])]
    for i in range(img.shape[0]):
        for j in range(img.shape[1]):
            # Get and set nearest color for pixel
            closest = closest_color(img[i, j][::-1], brick_colors)
            img[i, j] = closest.rgb[::-1]
            color_grid[i][j] = closest
            # Update color stats
            if closest not in stats:
                stats[closest] = BrickColorStats(closest)
            stats[closest].count = stats[closest].count + 1
    return stats, color_grid


def add_grid(img, pixels, spacing):
    line_frac = 0.002
    line_width = int(round(min(line_frac * img.shape[0], line_frac * img.shape[1])))
    for i in range(pixels[0] + 1):
        if i % spacing[0] == 0:
            x = int(round(float(i) / pixels[0] * img.shape[0]))
            cv2.line(img, (x, 0), (x, img.shape[0]), (0, 0, 0), line_width)
    for i in range(pixels[1] + 1):
        if i % spacing[1] == 0:
            y = int(round(float(i) / pixels[1] * img.shape[1]))
            cv2.line(img, (0, y), (img.shape[0], y), (0, 0, 0), line_width)


def write_xml_bytes(stats, spares_per_lot: int = 5) -> bytes:
    """
    Builds the bricklink XML export (bill of material) for the given stats.
    :param stats: The stats to export.
    :param spares_per_lot: The number of spares to add per color/brick, just in case of loosing some.
    :return: The XML document, serialized to bytes.
    """
    root = xmlET.Element("INVENTORY")
    for colorStat in stats.items():
        count = colorStat[1].count + spares_per_lot
        color_root = xmlET.SubElement(root, "ITEM")
        xmlET.SubElement(color_root, "ITEMTYPE").text = "P"
        xmlET.SubElement(color_root, "ITEMID").text = colorStat[0].colorType
        xmlET.SubElement(color_root, "COLOR").text = colorStat[0].colorId
        xmlET.SubElement(color_root, "MINQTY").text = str(count)
        xmlET.SubElement(color_root, "CONDITION").text = "X"
    return xmlET.tostring(root, encoding="unicode").encode("UTF-8")


# ===> Uploaded-image handling


def decode_image(image_bytes: bytes):
    """
    Decodes an uploaded image's raw bytes (e.g. from a browser file upload)
    into a cv2 BGR array, without ever touching disk.
    :param image_bytes: The raw (encoded, e.g. JPEG/PNG) image bytes.
    :return: The decoded BGR image array.
    """
    buffer = np.frombuffer(image_bytes, dtype=np.uint8)
    image = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Could not decode image data; unsupported or corrupt image file.")
    return image


def center_crop_to_ratio(img, target_width: int, target_height: int):
    """
    Center-crops a BGR image array to match the aspect ratio of target_width/target_height,
    so uploaded images of arbitrary aspect ratio aren't stretched/distorted when resized
    down to the mosaic's stud grid.
    """
    target_ratio = target_width / target_height
    height, width = img.shape[:2]
    img_ratio = width / height

    if img_ratio > target_ratio:
        new_width = int(height * target_ratio)
        left = (width - new_width) // 2
        return img[:, left:left + new_width]
    elif img_ratio < target_ratio:
        new_height = int(width / target_ratio)
        top = (height - new_height) // 2
        return img[top:top + new_height, :]
    return img


def generate_mosaic(
    image_bytes: bytes,
    colors: list[BrickColor],
    width: int,
    height: int,
    grid_cell: tuple[int, int] | None = (8, 8),
    out_size: tuple[int, int] = (1000, 1000),
) -> dict:
    """
    Generates a brick mosaic straight from an uploaded image's raw bytes (no
    file path required).
    :param image_bytes: The raw (encoded) bytes of the uploaded image.
    :param colors: The brick colors to map the image onto.
    :param width: The width of the mosaic, in studs.
    :param height: The height of the mosaic, in studs.
    :param grid_cell: The helper-grid cell size (rows, cols), or None to skip the grid.
    :param out_size: The pixel size of the rendered preview images.
    :return: A dict with the input/pixelated/bricks/output images (BGR arrays),
        the color stats and the per-stud color grid.
    """
    image_input = decode_image(image_bytes)
    image_input = center_crop_to_ratio(image_input, width, height)

    image_pixelated = cv2.resize(image_input, (width, height), interpolation=cv2.INTER_LINEAR)
    image_bricks = image_pixelated.copy()

    stats, color_grid = replace_with_brick_colors(image_bricks, colors)

    w_out, h_out = out_size
    image_output = cv2.resize(image_bricks, (w_out, h_out), interpolation=cv2.INTER_NEAREST)
    if grid_cell is not None:
        add_grid(image_output, (width, height), grid_cell)

    return {
        "input": cv2.resize(image_input, (w_out, h_out), interpolation=cv2.INTER_NEAREST),
        "pixelated": cv2.resize(image_pixelated, (w_out, h_out), interpolation=cv2.INTER_NEAREST),
        "bricks": image_bricks,
        "output": image_output,
        "stats": stats,
        "color_grid": color_grid,
    }
