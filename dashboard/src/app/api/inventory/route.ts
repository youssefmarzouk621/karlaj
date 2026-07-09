import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/inventory?partId=<id>&paletteId=<id>
// One row per color of the palette, left-joined with its inventory item for the
// selected part (colors with no stock report quantity/grams of 0).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const partId = searchParams.get("partId");
  const paletteId = searchParams.get("paletteId");
  if (!partId || !paletteId) {
    return NextResponse.json({ error: "partId and paletteId are required" }, { status: 400 });
  }

  const [part, palette] = await Promise.all([
    prisma.part.findUnique({ where: { id: partId } }),
    prisma.palette.findUnique({
      where: { id: paletteId },
      include: { colors: { orderBy: { sortOrder: "asc" } } },
    }),
  ]);
  if (!part || !palette) {
    return NextResponse.json({ error: "Part or palette not found" }, { status: 404 });
  }

  const items = await prisma.inventoryItem.findMany({ where: { partId } });
  const byColor = new Map(items.map((it) => [it.colorId, it]));

  const rows = palette.colors.map((c) => {
    const it = byColor.get(c.id);
    return {
      colorId: c.id,
      name: c.name,
      hex: c.hex,
      code: c.code,
      quantity: it?.quantity ?? 0,
      grams: it?.grams ?? 0,
    };
  });

  return NextResponse.json({
    part: { id: part.id, name: part.name, partId: part.partId, weightGrams: part.weightGrams },
    palette: { id: palette.id, name: palette.name },
    rows,
  });
}

// PUT /api/inventory  { partId, colorId, quantity?, grams? }
// Upsert one (part, color) stock line. Fields absent from the body default to 0
// on create and are left untouched on update.
export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { partId, colorId } = body;
  if (!partId || !colorId) {
    return NextResponse.json({ error: "partId and colorId are required" }, { status: 400 });
  }

  const hasQuantity = "quantity" in body;
  const hasGrams = "grams" in body;
  const quantity = hasQuantity ? Math.max(0, Math.round(Number(body.quantity) || 0)) : undefined;
  const grams = hasGrams ? Math.max(0, Number(body.grams) || 0) : undefined;

  const item = await prisma.inventoryItem.upsert({
    where: { partId_colorId: { partId, colorId } },
    create: { partId, colorId, quantity: quantity ?? 0, grams: grams ?? 0 },
    update: {
      ...(quantity !== undefined ? { quantity } : {}),
      ...(grams !== undefined ? { grams } : {}),
    },
  });

  return NextResponse.json({ item });
}
