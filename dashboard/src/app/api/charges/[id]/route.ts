import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  for (const key of ["name", "price", "displayPrice", "enabled", "sortOrder"]) {
    if (key in body) data[key] = body[key];
  }
  const charge = await prisma.extraCharge.update({ where: { id }, data });
  return NextResponse.json({ charge });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await prisma.extraCharge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
