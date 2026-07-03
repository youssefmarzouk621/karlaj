import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const [hero, features] = await Promise.all([
    prisma.heroContent.findFirst({ where: { active: true } }),
    prisma.feature.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  return NextResponse.json({ hero, features });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { hero, features } = body;

  if (hero) {
    if (hero.id) {
      await prisma.heroContent.update({ where: { id: hero.id }, data: hero });
    } else {
      await prisma.heroContent.create({ data: hero });
    }
  }

  if (features) {
    for (const feature of features) {
      if (feature.id) {
        await prisma.feature.update({ where: { id: feature.id }, data: feature });
      } else {
        await prisma.feature.create({ data: feature });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
