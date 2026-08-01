import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const charges = await prisma.extraCharge.findMany({ orderBy: { sortOrder: "asc" } });
  return NextResponse.json({ charges });
}

export async function POST(request: NextRequest) {
  const { name, price, displayPrice, enabled } = await request.json();
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const count = await prisma.extraCharge.count();
  const charge = await prisma.extraCharge.create({
    data: {
      name: name.trim(),
      price: typeof price === "number" ? price : 0,
      displayPrice: typeof displayPrice === "string" ? displayPrice : "",
      enabled: enabled ?? true,
      sortOrder: count,
    },
  });
  return NextResponse.json({ charge });
}
