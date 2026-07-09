import { NextRequest, NextResponse } from "next/server";
import { prisma, SETTING_KEYS, getCustomSizeEnabled } from "@/lib/db";

// GET /api/settings -> the current feature-flag values.
export async function GET() {
  const customSizeEnabled = await getCustomSizeEnabled(prisma);
  return NextResponse.json({ customSizeEnabled });
}

// PUT /api/settings { customSizeEnabled: boolean } -> upsert the flag(s) present.
export async function PUT(request: NextRequest) {
  const body = await request.json();
  if ("customSizeEnabled" in body) {
    const value = String(!!body.customSizeEnabled);
    await prisma.setting.upsert({
      where: { key: SETTING_KEYS.customSizeEnabled },
      create: { key: SETTING_KEYS.customSizeEnabled, value },
      update: { value },
    });
  }
  const customSizeEnabled = await getCustomSizeEnabled(prisma);
  return NextResponse.json({ customSizeEnabled });
}
