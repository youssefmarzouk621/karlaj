// Idempotent seed for mosaic bases: parts with kind = BASE, plus which bricks
// fit on each one, and the connectors (kind = CONNECTOR) that pin bases
// together. Bases are what a mosaic is built on (the generator never places
// them); the dashboard requires at least one enabled base, compatible with
// every enabled brick. The first enabled connector is the pin the generator
// lists for joining bases.
//
// Run: node seed/seed-bases.mjs   (after `npm run db:push`, and after the
// brick seeds so the compatibility links have bricks to point at)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// `fits` lists the BrickLink ids of the bricks that seat on this base, or "*"
// for every BRICK part (any base with standard studs).
const BASES = [
  {
    // 16x16x1⅓ Technic plate: holes along every side, so bases pin together
    // (Technic pin 3673/2780) into bigger boards — the LEGO Art system.
    name: "16x16 Technic Base",
    partId: "65803",
    width: 16,
    height: 16,
    weightGrams: 11.5, // approximate; editable in the dashboard
    fits: "*",
  },
];

const CONNECTORS = [
  {
    // Technic pin without friction ridges, sold by Yusin Chen (Bebricks):
    // https://french.alibaba.com/product-detail/subject-1601712766124.html
    name: "Technic Pin",
    partId: "3673",
    width: 1,
    height: 2,
    weightGrams: 0.18, // approximate; editable in the dashboard
  },
];

async function main() {
  const bricks = await prisma.part.findMany({ where: { kind: "BRICK" }, select: { id: true, partId: true } });
  let sortOrder = await prisma.part.count();

  for (const { fits, ...b } of BASES) {
    const exists = await prisma.part.findUnique({ where: { partId: b.partId } });
    const base = await prisma.part.upsert({
      where: { partId: b.partId },
      // `enabled` is not updated: which base is live is chosen in the dashboard.
      update: { name: b.name, kind: "BASE", width: b.width, height: b.height },
      create: { ...b, kind: "BASE", enabled: true, sortOrder: sortOrder++ },
    });

    // Additive: connect missing links, never drop ones added since.
    const targets = fits === "*" ? bricks : bricks.filter((p) => fits.includes(p.partId));
    await prisma.part.update({
      where: { id: base.id },
      data: { compatibleBricks: { connect: targets.map((p) => ({ id: p.id })) } },
    });

    console.log(
      `Base ${b.partId} ${exists ? "updated" : "created"} (${base.enabled ? "enabled" : "disabled"}), ` +
        `fits ${targets.length} bricks.`
    );
  }

  for (const c of CONNECTORS) {
    const exists = await prisma.part.findUnique({ where: { partId: c.partId } });
    const part = await prisma.part.upsert({
      where: { partId: c.partId },
      // `enabled` is not updated: which connector is live is chosen in the dashboard.
      update: { name: c.name, kind: "CONNECTOR" },
      create: { ...c, kind: "CONNECTOR", enabled: true, sortOrder: sortOrder++ },
    });
    console.log(
      `Connector ${c.partId} ${exists ? "updated" : "created"} (${part.enabled ? "enabled" : "disabled"}).`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
