import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  // Enabling a palette disables every other one (exactly one enabled palette).
  if (body.enabled === true) {
    await prisma.$transaction([
      prisma.palette.updateMany({ data: { enabled: false } }),
      prisma.palette.update({ where: { id }, data: { enabled: true } }),
    ]);
  } else if (body.enabled === false) {
    await prisma.palette.update({ where: { id }, data: { enabled: false } });
  }

  if (typeof body.name === "string" && body.name.trim()) {
    await prisma.palette.update({ where: { id }, data: { name: body.name.trim() } });
  }

  if (typeof body.priceMultiplier === "number" && Number.isFinite(body.priceMultiplier)) {
    await prisma.palette.update({
      where: { id },
      data: { priceMultiplier: body.priceMultiplier },
    });
  }

  const palette = await prisma.palette.findUnique({
    where: { id },
    include: { colors: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ palette });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.palette.delete({ where: { id } }); // colors cascade
  return NextResponse.json({ ok: true });
}
