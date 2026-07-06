"""Generates a simple instruction/parts-list PDF for a brickmos mosaic result.

Mirrors (in a simplified form, since brickmos only places 1x1 studs) the PDF
produced by the `backend` FastAPI service, so the frontend's "download
instruction PDF" button behaves the same regardless of which service produced
the mosaic.
"""

from io import BytesIO

from reportlab.lib.colors import HexColor, black
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = A4
MARGIN = 15 * mm


def _rgb_to_color(rgb):
    return HexColor(f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}")


def _draw_mosaic(c: canvas.Canvas, grid: list[list[int]], color_by_id: dict, x: float, y: float, max_w: float, max_h: float):
    rows = len(grid)
    cols = len(grid[0]) if rows else 0
    cell = min(max_w / cols, max_h / rows) if cols and rows else 0

    for r in range(rows):
        for col in range(cols):
            rgb = color_by_id[grid[r][col]]
            cx = x + col * cell
            cy = y + (rows - 1 - r) * cell
            c.setFillColor(_rgb_to_color(rgb))
            c.setStrokeColor(HexColor("#444444"))
            c.setLineWidth(0.25)
            c.rect(cx, cy, cell, cell, fill=1, stroke=1)

    return cols * cell, rows * cell


def _draw_parts_table(c: canvas.Canvas, parts: list[dict], start_y: float, title: str) -> float:
    y = start_y
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(black)
    c.drawString(MARGIN, y, title)
    y -= 8 * mm

    c.setFont("Helvetica-Bold", 9)
    c.drawString(MARGIN, y, "Color")
    c.drawString(MARGIN + 15 * mm, y, "Part")
    c.drawString(MARGIN + 65 * mm, y, "Color")
    c.drawString(MARGIN + 115 * mm, y, "Qty")
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

        c.setFillColor(_rgb_to_color(part["rgb"]))
        c.rect(MARGIN, y - 1 * mm, 10 * mm, 5 * mm, fill=1, stroke=1)

        c.setFillColor(black)
        c.drawString(MARGIN + 15 * mm, y, part["part_name"])
        c.drawString(MARGIN + 65 * mm, y, part["color_name"])
        c.drawString(MARGIN + 115 * mm, y, str(part["quantity"]))
        y -= 7 * mm

    return y


def generate_pdf(mosaic_data: dict) -> bytes:
    """Generate a mosaic preview + parts list PDF from a brickmos /process result."""
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    grid = mosaic_data["grid"]
    width = mosaic_data["width"]
    height = mosaic_data["height"]
    parts_list = mosaic_data["parts_list"]
    color_by_id = {p["color_id"]: p["rgb"] for p in parts_list}

    # === COVER PAGE: mosaic preview ===
    y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(black)
    c.drawCentredString(PAGE_W / 2, y, "LEGO Mosaic (brickmos)")
    y -= 12 * mm

    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor("#555555"))
    c.drawCentredString(
        PAGE_W / 2, y, f"{width} x {height} studs  •  {mosaic_data['total_parts']} pieces"
    )
    y -= 20 * mm

    preview_max = min(PAGE_W - 2 * MARGIN, y - MARGIN)
    _draw_mosaic(
        c, grid, color_by_id,
        x=MARGIN,
        y=y - preview_max,
        max_w=preview_max,
        max_h=preview_max,
    )

    # === PARTS LIST PAGE ===
    c.showPage()
    y = PAGE_H - MARGIN
    _draw_parts_table(c, parts_list, y, "Complete Parts List (Bricklink BOM)")

    c.save()
    return buffer.getvalue()
