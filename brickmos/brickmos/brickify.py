import argparse
import os
import sys

import cv2

from . import defaults
from .mosaic_core import (
    add_grid,
    read_colors,
    replace_with_brick_colors,
    write_xml_bytes,
)

# ===> Constants

NO_GRID = "none"  # Argument value for deactivating the helper grid


# ===> Argument handling


def init_and_get_arguments():
    """
    Creates an argument parser, handles it and returns the prepared arguments.
    :return: The arguments.
    """
    parser = argparse.ArgumentParser(
        description="brick-mosaic: 'Mosaicify' an image using brick colors and export bill of material"
    )
    parser.add_argument(
        "--image_file",
        "-i",
        required=True,
        type=str,
        help="the image to process",
    )
    parser.add_argument(
        "--color_file",
        type=str,
        default="",
        help="the csv-file defining the brick-colors to be used (if not given, colors.csv at script "
        "location is attempted)",
    )
    parser.add_argument(
        "--output_directory",
        "-o",
        type=str,
        default=".",
        help="the directory the output image and BOM is written to (default is current working dir)",
    )
    parser.add_argument(
        "--spares",
        type=int,
        default=0,
        help="the number of spares to add per color/brick (bricklink), just in case of loosing some bricks",
    )
    parser.add_argument(
        "--size",
        type=str,
        default="48x48",
        help="the size of the mosaic (default is 48x48 bricks)",
    )
    parser.add_argument(
        "--grid_cell",
        type=str,
        default="8x8",
        help=f"the size of a helper grid cell (default is 8x8 bricks, '{NO_GRID}' removes the grid)",
    )
    parser.add_argument(
        "--no_preview",
        dest="no_preview",
        action="store_true",
        default=False,
        help="indicates whether to skip immediately showing the images",
    )
    # Retrieve arguments
    args = parser.parse_args()
    # Use default color definition location, if not given
    if args.color_file != "" and not os.path.exists(args.color_file):
        print(f"No color definition file found at {args.color_file}, exiting ...")
        sys.exit(-1)
    # Quick check for image file presence
    if not os.path.exists(args.image_file):
        print(f"Cannot find image file at {args.image_file}, exiting ...")
        sys.exit(-2)
    # Get image size
    try:
        width, height = (int(a) for a in args.size.split("x"))
        args.width = width
        args.height = height
    except Exception:
        print(f"Cannot parse --size argument. Got {args.size}, but wanted something like 48x48")
        sys.exit(-3)
    # Get helper grid cell size
    if args.grid_cell != NO_GRID:
        try:
            width, height = (int(a) for a in args.grid_cell.split("x"))
            args.grid_cell_width = width
            args.grid_cell_height = height
        except Exception:
            print(f"Cannot parse --grid_cell argument. Got {args.grid_cell}, but wanted something like 8x8")
            sys.exit(-4)
    # Get helper grid size
    # Create output directory, if it does not exist
    os.makedirs(args.output_directory, exist_ok=True)
    return args


# ===> Main start


def main():
    # Get arguments
    args = init_and_get_arguments()

    # Read color info - find colors here: https://www.bricklink.com/catalogColors.asp
    color_info = ""
    if args.color_file == "":
        color_info = defaults.get_default_colors()
    else:
        with open(args.color_file) as f:
            color_info = f.read()
    colors = read_colors(color_info)

    # Input image
    image_input = cv2.imread(args.image_file)

    # Desired "pixelated" size
    w, h = (args.width, args.height)
    # Desired output size
    w_out, h_out = (1000, 1000)

    # Resize input to "pixelated" size
    image_pixelated = cv2.resize(image_input, (w, h), interpolation=cv2.INTER_LINEAR)
    image_bricks = image_pixelated.copy()

    # Replace with brick colors
    statistics, _ = replace_with_brick_colors(image_bricks, colors)

    # Initialize output image
    image_output = cv2.resize(image_bricks, (w_out, h_out), interpolation=cv2.INTER_NEAREST)

    # Add helper grid
    grid_spacing = args.grid_cell_width, args.grid_cell_height
    if args.grid_cell != NO_GRID:
        add_grid(image_output, (w, h), grid_spacing)

    # Show some statistics
    print(f"Colors ({len(statistics)} colors, {sum([i.count for i in statistics.values()])} tiles):")
    for item in sorted(statistics.items(), key=lambda x: -x[1].count):
        print(f"{item[0].colorName}: {item[1].count}")

    # Output bricklink xml
    with open(os.path.join(args.output_directory, "bricklink.xml"), "wb") as f:
        f.write(write_xml_bytes(statistics))

    # Prepare pixelated image for analysis (just resize it)
    image_input = cv2.resize(image_input, (w_out, h_out), interpolation=cv2.INTER_NEAREST)
    image_pixelated = cv2.resize(image_pixelated, (w_out, h_out), interpolation=cv2.INTER_NEAREST)

    # Write images
    cv2.imwrite(os.path.join(args.output_directory, "1.input.jpg"), image_input)
    cv2.imwrite(os.path.join(args.output_directory, "2.pixelated.jpg"), image_pixelated)
    cv2.imwrite(os.path.join(args.output_directory, "3.output.jpg"), image_output)

    # Show images
    if not args.no_preview:
        cv2.imshow("Input", image_input)
        cv2.imshow("Pixelated", image_pixelated)
        cv2.imshow("Output", image_output)
        # Wait for user to quit
        cv2.waitKey(0)


if __name__ == "__main__":
    main()
