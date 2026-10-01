import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { validateParts } from "@/lib/parts";

// Parts with their brick -> base compatibility flattened to an id list.
async function listParts() {
  const parts = await prisma.part.findMany({
    orderBy: { sortOrder: "asc" },
    include: { compatibleBases: { select: { id: true } } },
  });
  return parts.map(({ compatibleBases, ...p }) => ({
    ...p,
    compatibleBaseIds: compatibleBases.map((b) => b.id),
  }));
}

export async function GET() {
  return NextResponse.json({ parts: await listParts() });
}

// PUT /api/parts { updates: [{ id, enabled?, variable?, weightGrams? }] }
// Batched save from the Parts page. The edits are merged onto the current rows
// and the resulting set is validated as a whole (one enabled 1x1, at least one
// enabled base that fits every enabled brick) before anything is written; then
// everything is applied in one transaction.
export async function PUT(request: NextRequest) {
  const { updates } = await request.json();
  if (!Array.isArray(updates)) {
    return NextResponse.json({ error: "updates must be an array" }, { status: 400 });
  }

  const toNullableNumber = (v: unknown) => (v === "" || v === null ? null : Number(v));
  const byId = new Map(
    updates.map((u: { id: string; enabled?: unknown; variable?: unknown; weightGrams?: unknown }) => [
      u.id,
      u,
    ])
  );

  const current = await listParts();
  const known = new Set(current.map((p) => p.id));
  if (updates.some((u: { id: string }) => !known.has(u.id))) {
    return NextResponse.json({ error: "Unknown part id" }, { status: 400 });
  }

  const merged = current.map((p) => {
    const u = byId.get(p.id);
    if (!u) return p;
    return {
      ...p,
      ...(typeof u.enabled === "boolean" ? { enabled: u.enabled } : {}),
      ...("variable" in u ? { variable: toNullableNumber(u.variable) } : {}),
      ...("weightGrams" in u ? { weightGrams: toNullableNumber(u.weightGrams) } : {}),
    };
  });

  const errors = validateParts(merged);
  if (errors.length) {
    return NextResponse.json({ error: errors.join(" "), errors }, { status: 400 });
  }

  await prisma.$transaction(
    merged
      .filter((p) => byId.has(p.id))
      .map((p) =>
        prisma.part.update({
          where: { id: p.id },
          data: { enabled: p.enabled, variable: p.variable, weightGrams: p.weightGrams },
        })
      )
  );
  return NextResponse.json({ parts: await listParts() });
}
