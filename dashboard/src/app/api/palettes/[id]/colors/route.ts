import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

interface ColorInput {
  name: string;
  hex: string;
  code?: string | null;
  // Colors sourced outside the supplier's own range (the neutrals). Carried
  // through the round-trip so a save from the editor doesn't drop the flag.
  external?: boolean;
}

// Parse "#RRGGBB" -> [r,g,b]; returns null if malformed.
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Replace the whole color list for a palette in one shot.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { colors } = (await request.json()) as { colors: ColorInput[] };

  const rows = [];
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    const rgb = hexToRgb(c.hex);
    if (!rgb) {
      return NextResponse.json(
        { error: `Invalid hex "${c.hex}" for color "${c.name}"` },
        { status: 400 }
      );
    }
    rows.push({
      paletteId: id,
      name: c.name?.trim() || `Color ${i + 1}`,
      hex: `#${rgb.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`,
      r: rgb[0],
      g: rgb[1],
      b: rgb[2],
      code: c.code?.trim() || null,
      external: c.external === true,
      sortOrder: i,
    });
  }

  await prisma.$transaction([
    prisma.color.deleteMany({ where: { paletteId: id } }),
    prisma.color.createMany({ data: rows }),
  ]);

  const palette = await prisma.palette.findUnique({
    where: { id },
    include: { colors: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ palette });
}
