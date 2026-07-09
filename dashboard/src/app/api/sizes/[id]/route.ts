import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  for (const key of ["width", "height", "label", "enabled", "sortOrder"]) {
    if (key in body) data[key] = body[key];
  }
  const size = await prisma.mosaicSize.update({ where: { id }, data });
  return NextResponse.json({ size });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.mosaicSize.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
