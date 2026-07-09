import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const palettes = await prisma.palette.findMany({
    orderBy: { sortOrder: "asc" },
    include: { colors: { orderBy: { sortOrder: "asc" } } },
  });
  return NextResponse.json({ palettes });
}

export async function POST(request: NextRequest) {
  const { name } = await request.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const count = await prisma.palette.count();
  const palette = await prisma.palette.create({
    data: { name: name.trim(), enabled: false, sortOrder: count },
  });
  return NextResponse.json({ palette });
}
