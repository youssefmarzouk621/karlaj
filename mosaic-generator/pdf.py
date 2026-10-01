"""Mosaic preview + BrickLink parts-list PDF. Adapted from brickmos's exporter;
draws each placement at its own size so it already supports larger bricks."""

from __future__ import annotations

from io import BytesIO

from reportlab.lib.colors import HexColor, black
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

PAGE_W, PAGE_H = A4
MARGIN = 15 * mm


def _rgb_to_color(rgb):
    return HexColor(f"#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}")


def _draw_mosaic(c, placements, rows, cols, x, y, max_w, max_h, layout=None):
    cell = min(max_w / cols, max_h / rows) if cols and rows else 0
    for p in placements:
        bw, bh = p["brick_width"], p["brick_height"]
        cx = x + p["col"] * cell
        cy = y + (rows - 1 - p["row"] - (bh - 1)) * cell
        c.setFillColor(_rgb_to_color(p["rgb"]))
        c.setStrokeColor(HexColor("#444444"))
        c.setLineWidth(0.25)
        c.rect(cx, cy, bw * cell, bh * cell, fill=1, stroke=1)

    # Base seams, numbered like the bags so the builder knows which bag goes where.
    if layout:
        c.setStrokeColor(black)
        c.setLineWidth(1.2)
        base_w, base_h = layout["base_width"] * cell, layout["base_height"] * cell
        top = y + rows * cell
        for i in range(layout["count"]):
            r, col = divmod(i, layout["cols"])
            bx, by_top = x + col * base_w, top - r * base_h
            w = min(base_w, x + cols * cell - bx)
            h = min(base_h, by_top - y)
            c.rect(bx, by_top - h, w, h, fill=0, stroke=1)
            c.setFillColor(HexColor("#ffffff"))
            c.circle(bx + 3 * mm, by_top - 3 * mm, 2.2 * mm, fill=1, stroke=1)
            c.setFillColor(black)
            c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(bx + 3 * mm, by_top - 3.8 * mm, str(i + 1))


def _draw_parts_table(c, parts, start_y, title):
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


def _draw_base_table(c, layout, start_y):
    """Bases and the pins that join them — not placements, so not in the BOM."""
    y = start_y
    c.setFont("Helvetica-Bold", 14)
    c.setFillColor(black)
    c.drawString(MARGIN, y, "Bases")
    y -= 8 * mm
    c.setFont("Helvetica", 9)
    rows = [(f"{layout['name']} ({layout['part_id']})", layout["count"])]
    if layout["pins"]["quantity"]:
        pins = layout["pins"]
        rows.append((f"{pins['name']} ({pins['part_id']})", pins["quantity"]))
    for name, qty in rows:
        c.drawString(MARGIN + 15 * mm, y, name)
        c.drawString(MARGIN + 115 * mm, y, str(qty))
        y -= 7 * mm
    if not layout["exact"]:
        c.setFillColor(HexColor("#aa5500"))
        c.drawString(MARGIN + 15 * mm, y, "The mosaic doesn't fill its last row/column of bases; those studs stay bare.")
        c.setFillColor(black)
        y -= 7 * mm
    return y - 8 * mm


def generate_pdf(mosaic_data: dict) -> bytes:
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)

    width = mosaic_data["width"]
    height = mosaic_data["height"]

    y = PAGE_H - MARGIN
    c.setFont("Helvetica-Bold", 28)
    c.setFillColor(black)
    c.drawCentredString(PAGE_W / 2, y, "LEGO Mosaic")
    y -= 12 * mm
    c.setFont("Helvetica", 14)
    c.setFillColor(HexColor("#555555"))
    c.drawCentredString(PAGE_W / 2, y, f"{width} x {height} studs  •  {mosaic_data['total_parts']} pieces")
    layout = mosaic_data.get("base_layout")
    if layout:
        y -= 7 * mm
        c.setFont("Helvetica", 11)
        c.drawCentredString(
            PAGE_W / 2, y,
            f"Built on {layout['count']} x {layout['name']} "
            f"({layout['rows']} x {layout['cols']})  •  one bag per base",
        )
    y -= 20 * mm

    preview_max = min(PAGE_W - 2 * MARGIN, y - MARGIN)
    _draw_mosaic(c, mosaic_data["placements"], height, width,
                 x=MARGIN, y=y - preview_max, max_w=preview_max, max_h=preview_max,
                 layout=layout)

    c.showPage()
    y = PAGE_H - MARGIN
    if layout:
        y = _draw_base_table(c, layout, y)
    _draw_parts_table(c, mosaic_data["parts_list"], y, "Complete Parts List (Bricklink BOM)")

    c.save()
    return buffer.getvalue()
