import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const sizes = await prisma.mosaicSize.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ sizes });
}

// PUT /api/sizes { updates: [{ id, enabled?, label? }] }
// Batched save of the enabled/label edits made on the dashboard, so toggling a
// checkbox no longer fires one request per change. Runs in a single transaction.
export async function PUT(request: NextRequest) {
  const { updates } = await request.json();
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "updates must be an array" }, { status: 400 });
  }
  await prisma.$transaction(
    updates.map((u: { id: string; enabled?: boolean; label?: string | null }) =>
      prisma.mosaicSize.update({
        where: { id: u.id },
        data: {
          ...(typeof u.enabled === "boolean" ? { enabled: u.enabled } : {}),
          ...("label" in u ? { label: u.label || null } : {}),
        },
      })
    )
  );
  const sizes = await prisma.mosaicSize.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ sizes });
}

export async function POST(request: NextRequest) {
  const { width, height, label, enabled } = await request.json();
  if (!Number.isInteger(width) || !Number.isInteger(height)) {
    return NextResponse.json({ error: "width and height must be integers" }, { status: 400 });
  }
  const count = await prisma.mosaicSize.count();
  const size = await prisma.mosaicSize.create({
    data: {
      width,
      height,
      label: label || null,
      enabled: enabled ?? true,
      sortOrder: count,
    },
  });
  return NextResponse.json({ size });
}
