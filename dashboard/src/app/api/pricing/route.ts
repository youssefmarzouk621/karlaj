import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const plans = await prisma.pricingPlan.findMany({
    where: { active: true },
    include: { features: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json(plans);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { features: featureTexts, ...planData } = body;

  const plan = await prisma.pricingPlan.create({
    data: {
      ...planData,
      features: {
        create: (featureTexts || []).map((text: string, i: number) => ({
          text,
          sortOrder: i,
        })),
      },
    },
    include: { features: true },
  });

  return NextResponse.json(plan);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, features: featureTexts, ...planData } = body;

  await prisma.pricingFeature.deleteMany({ where: { planId: id } });

  const plan = await prisma.pricingPlan.update({
    where: { id },
    data: {
      ...planData,
      features: {
        create: (featureTexts || []).map((text: string, i: number) => ({
          text,
          sortOrder: i,
        })),
      },
    },
    include: { features: true },
  });

  return NextResponse.json(plan);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await prisma.pricingPlan.update({
    where: { id },
    data: { active: false },
  });

  return NextResponse.json({ ok: true });
}
