import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data: Record<string, unknown> = {};
  if ("enabled" in body) data.enabled = body.enabled;
  if ("variable" in body) {
    // empty string / null clears the cap; otherwise store as a float
    data.variable = body.variable === "" || body.variable === null ? null : Number(body.variable);
  }
  if ("weightGrams" in body) {
    // empty string / null clears the weight; otherwise store as a float (g/piece)
    data.weightGrams =
      body.weightGrams === "" || body.weightGrams === null ? null : Number(body.weightGrams);
  }
  const part = await prisma.part.update({ where: { id }, data });
  return NextResponse.json({ part });
}
