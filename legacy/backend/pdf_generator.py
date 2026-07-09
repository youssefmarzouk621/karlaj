from io import BytesIO
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.colors import Color, HexColor, black, white
from reportlab.pdfgen import canvas
import numpy as np
from color_palette import LegoPalette

palette = LegoPalette()

PAGE_W, PAGE_H = A4
MARGIN = 15 * mm

SYMBOLS = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@&*+=$%")


def _rgb_to_color(rgb: list[int]) -> Color:
    return Color(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255)


def _draw_mosaic_with_bricks(c: canvas.Canvas, placements: list[dict],
                              grid_rows: int, grid_cols: int,
                              x: float, y: float, max_w: float, max_h: float):
    """Draw the mosaic showing actual brick outlines."""
    cell = min(max_w / grid_cols, max_h / grid_rows)

    for p in placements:
        rgb = palette.get_rgb(p["color_id"])
        bw, bh = p["brick_width"], p["brick_height"]
        cx = x + p["col"] * cell
        cy = y + (grid_rows - 1 - p["row"] - (bh - 1)) * cell

        c.setFillColor(_rgb_to_color(rgb))
        c.setStrokeColor(HexColor("#444444"))
        c.setLineWidth(0.5)
        c.rect(cx, cy, bw * cell, bh * cell, fill=1, stroke=1)

    return grid_cols * cell, grid_rows * cell


def _draw_parts_table(c: canvas.Canvas, parts: list[dict], start_y: float, title: str):
    """Draw a parts list table with color swatches and part names."""
    y = start_y
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(black)
    c.drawString(MARGIN, y, title)
    y -= 8 * mm

    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN, y, "Color")
    c.drawString(MARGIN + 15 * mm, y, "Part")
    c.drawString(MARGIN + 55 * mm, y, "Color")
    c.drawString(MARGIN + 95 * mm, y, "Qty")
    y -= 2 * mm
    c.setStrokeColor(HexColor("#cccccc"))
    c.line(MARGIN, y, PAGE_W - MARGIN, y)
    y -= 5 * mm

    c.setFont("Helvetica", 9)
    for part in parts:
        if y < MARGIN + 10 * mm:
            c.showPage()
            y = PAGE_H - MARGIN - 10 * mm
            c.setFont("Helvetica", 9)

        rgb = part["rgb"]
        c.setFillColor(_rgb_to_color(rgb))
        c.rect(MARGIN, y - 1 * mm, 10 * mm, 5 * mm, fill=1, stroke=1)

        c.setFillColor(black)
        c.drawString(MARGIN + 15 * mm, y, part.get("part_name", ""))
        c.drawString(MARGIN + 55 * mm, y, part.get("color_name", part.get("name", "")))
        c.drawString(MARGIN + 95 * mm, y, str(part["quantity"]))
        y -= 7 * mm

    return y


def _draw_instruction_grid(c: canvas.Canvas, bag: dict, bag_number: int,
                            color_to_symbol: dict, full_width: int, full_height: int):
    """Draw a step-by-step instruction page showing brick outlines for one bag section."""
    c.showPage()
    y = PAGE_H - MARGIN
    section = bag["section"]

    c.setFont("Helvetica-Bold", 18)
    c.setFillColor(black)
    c.drawString(MARGIN, y, f"Bag {bag_number} — Build Steps")
    y -= 10 * mm

    c.setFont("Helvetica", 10)
    c.drawString(MARGIN, y,
                 f"Section: rows {section['row_start']+1}-{section['row_end']}, "
                 f"columns {section['col_start']+1}-{section['col_end']}")
    y -= 8 * mm

    grid = bag["grid"]
    rows = len(grid)
    cols = len(grid[0]) if rows > 0 else 0
    available_w = PAGE_W - 2 * MARGIN
    available_h = y - MARGIN - 40 * mm
    cell = min(available_w / cols, available_h / rows, 8 * mm)
    grid_w = cell * cols
    grid_h = cell * rows

    grid_x = MARGIN + (available_w - grid_w) / 2
    grid_y = y - grid_h

    r_off = section["row_start"]
    c_off = section["col_start"]

    # Draw brick outlines with color symbols
    font_size = max(4, min(7, cell / mm * 2.5))
    placements = bag.get("placements", [])
    for p in placements:
        bw, bh = p["brick_width"], p["brick_height"]
        pr, pc = p["row"] - r_off, p["col"] - c_off
        rgb = palette.get_rgb(p["color_id"])

        cx = grid_x + pc * cell
        cy = grid_y + (rows - 1 - pr - (bh - 1)) * cell

        c.setFillColor(_rgb_to_color(rgb))
        c.setStrokeColor(HexColor("#666666"))
        c.setLineWidth(0.75)
        c.rect(cx, cy, bw * cell, bh * cell, fill=1, stroke=1)

        # Symbol in center of brick
        symbol = color_to_symbol.get(p["color_id"], "?")
        brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000
        c.setFillColor(black if brightness > 128 else white)
        c.setFont("Helvetica-Bold", font_size)
        c.drawCentredString(
            cx + bw * cell / 2,
            cy + bh * cell / 2 - font_size * 0.35,
            symbol,
        )

    # Row/column numbers
    c.setFillColor(HexColor("#666666"))
    c.setFont("Helvetica", max(4, font_size - 1))
    for row_i in range(rows):
        label_y = grid_y + (rows - 1 - row_i) * cell + cell / 2 - 2
        c.drawRightString(grid_x - 2 * mm, label_y, str(section["row_start"] + row_i + 1))
    for col_i in range(cols):
        label_x = grid_x + col_i * cell + cell / 2
        c.drawCentredString(label_x, grid_y - 4 * mm, str(section["col_start"] + col_i + 1))

    # Legend
    legend_y = grid_y - 12 * mm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(black)
    c.drawString(MARGIN, legend_y, "Legend:")
    legend_y -= 6 * mm

    unique_ids = sorted(set(p["color_id"] for p in placements))
    legend_x = MARGIN
    c.setFont("Helvetica", 8)
    for color_id in unique_ids:
        if legend_x > PAGE_W - MARGIN - 40 * mm:
            legend_x = MARGIN
            legend_y -= 6 * mm
        if legend_y < MARGIN:
            break

        rgb = palette.get_rgb(color_id)
        color = palette.get_color(color_id)
        symbol = color_to_symbol.get(color_id, "?")

        c.setFillColor(_rgb_to_color(rgb))
        c.rect(legend_x, legend_y - 1 * mm, 4 * mm, 4 * mm, fill=1, stroke=1)
        c.setFillColor(black)
        c.drawString(legend_x + 5 * mm, legend_y, f"{symbol} = {color['name']}")
        legend_x += 45 * mm


def generate_pdf(mosaic_data: dict, bags: list[dict]) -> bytes:
    """Generate a complete LEGO instruction booklet PDF."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    grid = mosaic_data["grid"]
    width = mosaic_data["width"]
    height = mosaic_data["height"]
    placements = mosaic_data["placements"]

    # Build color→symbol mapping
    all_color_ids = sorted(set(cid for row in grid for cid in row))
    color_to_symbol = {}
    for i, cid in enumerate(all_color_ids):
        color_to_symbol[cid] = SYMBOLS[i % len(SYMBOLS)]

    # === COVER PAGE ===
    y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(black)
    c.drawCentredString(PAGE_W / 2, y, "LEGO Mosaic")
    y -= 12 * mm

    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor("#555555"))
    c.drawCentredString(PAGE_W / 2, y, f"{width} x {height} studs  •  {mosaic_data['total_parts']} pieces  •  {len(bags)} bags")
    y -= 20 * mm

    # Draw the completed mosaic with brick outlines
    preview_max = min(PAGE_W - 2 * MARGIN, y - MARGIN - 20 * mm)
    _draw_mosaic_with_bricks(
        c, placements, height, width,
        x=MARGIN + (PAGE_W - 2 * MARGIN - preview_max) / 2,
        y=y - preview_max,
        max_w=preview_max,
        max_h=preview_max,
    )

    # === PARTS OVERVIEW PAGE ===
    c.showPage()
    y = PAGE_H - MARGIN
    y = _draw_parts_table(c, mosaic_data["parts_list"], y, "Complete Parts List")

    # === BAG PAGES ===
    for bag in bags:
        c.showPage()
        y = PAGE_H - MARGIN
        y = _draw_parts_table(c, bag["parts"], y, f"Bag {bag['bag_number']} — Parts")

        _draw_instruction_grid(
            c, bag, bag["bag_number"],
            color_to_symbol, width, height,
        )

    # === FINAL PAGE ===
    c.showPage()
    y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 20)
    c.setFillColor(black)
    c.drawCentredString(PAGE_W / 2, y, "Completed Mosaic")
    y -= 15 * mm

    preview_max = min(PAGE_W - 2 * MARGIN, y - MARGIN)
    _draw_mosaic_with_bricks(
        c, placements, height, width,
        x=MARGIN + (PAGE_W - 2 * MARGIN - preview_max) / 2,
        y=y - preview_max,
        max_w=preview_max,
        max_h=preview_max,
    )

    c.save()
    return buffer.getvalue()
