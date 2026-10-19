// Idempotent seed for the Yusin Chen (Xingtai Bebricks Sales Co., Ltd, Alibaba)
// supplier line: the 1x1 round plate part (4073), its 48-color palette, one
// inventory row per color, and stock rows for his 16x16 Technic base (65803).
//
// Source listing (sold per 100 g bag, ~890 pcs, 4073):
//   https://french.alibaba.com/product-detail/subject-1601859009822.html
//
// The seller's codes are plain swatch numbers (1..48), not LEGO color ids, so
// every RGB below is sampled from the listing's rendered swatch images
// (dominant flat-face color of the piece). Names are the closest BrickLink
// equivalent, for readability only. Renders are not physical pieces: re-measure
// once the bags arrive.
//
// The part is shared with other round-plate suppliers (upsert by partId) and is
// created DISABLED if missing; the palette is created disabled too. Switching
// the live palette/part is an operational choice made in the dashboard.
//
// Run: node seed/seed-yusin-chen-round.mjs   (after `npm run db:push`)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PALETTE_NAME = "Yusin Chen";

// Pieces on hand per color: one 100 g bag as sold by the listing. Only applied
// when an inventory row is first created; existing stock is never overwritten.
const INITIAL_QUANTITY = 890;

const PART = {
  name: "1x1 Round Plate",
  partId: "4073",
  width: 1,
  height: 1,
  shape: "ROUND",
  variable: null,
  weightGrams: 100 / 890, // supplier: 100 g bag = 890 pcs; editable in the dashboard
};

// [seller code, name, hex] in the listing's swatch order.
const COLORS = [
  ["1", "Tan", "#DBC693"],
  ["2", "Flat Silver", "#A4A9B2"],
  ["3", "Yellowish Green", "#CAEA8C"],
  ["4", "Sand Blue", "#6B8CA3"],
  ["5", "Green", "#348C49"],
  ["6", "Dark Green", "#2A533A"],
  ["7", "Light Aqua", "#C6ECE4"],
  ["8", "Dark Red", "#7D252A"],
  ["9", "Cool White", "#E2EBEA"],
  ["10", "Bright Light Orange", "#F6AC36"],
  ["11", "Dark Brown", "#3D2522"],
  ["12", "Olive Green", "#8D9061"],
  ["13", "Bright Light Blue", "#92BDF7"],
  ["14", "Dark Olive Green", "#42623A"],
  ["15", "Dark Blue", "#293E6B"],
  ["16", "Medium Azure", "#3DC3D9"],
  ["17", "Dark Nougat", "#BC6B44"],
  ["18", "Dark Tan", "#968468"],
  ["19", "Magenta", "#BA4272"],
  ["20", "Medium Nougat", "#AE7B52"],
  ["21", "Cream", "#F5E5CC"],
  ["22", "Blue", "#2454BA"],
  ["23", "Dark Azure", "#329DF4"],
  ["24", "Light Lilac", "#BEC0F9"],
  ["25", "Medium Lavender", "#AC7AD9"],
  ["26", "Light Yellow", "#FBF4A2"],
  ["27", "Black", "#353535"],
  ["28", "Lavender", "#C2B6D2"],
  ["29", "Light Lemon", "#F3EE8D"],
  ["30", "Lime", "#A2D24A"],
  ["31", "Light Purple", "#B5A0E6"],
  ["32", "Red", "#DA2A2D"],
  ["33", "White", "#E6E3DD"],
  ["34", "Light Pink", "#F4C2DE"],
  ["35", "Dark Orange", "#B25931"],
  ["36", "Dark Purple", "#563BA4"],
  ["37", "Orange", "#FA873A"],
  ["38", "Light Gray", "#B2B3B3"],
  ["39", "Sand Green", "#84AF91"],
  ["40", "Reddish Brown", "#753E2A"],
  ["41", "Bright Green", "#33A44C"],
  ["42", "Light Nougat", "#FBCDAD"],
  ["43", "Bright Pink", "#F2AACE"],
  ["44", "Medium Blue", "#5397DA"],
  ["45", "Yellow", "#FACF42"],
  ["46", "Dark Pink", "#E66BA6"],
  ["47", "Dark Bluish Gray", "#6A6E6D"],
  ["48", "Light Bluish Gray", "#BEC1C6"],
];

// Other parts from the same supplier, stocked in palette colors (by seller
// code). The parts themselves are created by seed-bases.mjs; skipped if absent.
// Only Black is stocked for now.
//   65803 base: https://french.alibaba.com/product-detail/subject-1601715279431.html
//   (sold per bag of 4; also offered in Dark Bluish Gray, Light Bluish Gray, White)
//   3673 pin: https://french.alibaba.com/product-detail/subject-1601712766124.html
//   (bag size unknown: starts at 0, set the real count in the dashboard)
const EXTRA_STOCK = [
  { partId: "65803", codes: ["27"], quantity: 4 },
  { partId: "3673", codes: ["27"], quantity: 0 },
];

const rgb = (hx) => ({
  r: parseInt(hx.slice(1, 3), 16),
  g: parseInt(hx.slice(3, 5), 16),
  b: parseInt(hx.slice(5, 7), 16),
});

async function main() {
  const part = await prisma.part.upsert({
    where: { partId: PART.partId },
    // `enabled` is not updated: toggling parts is done in the dashboard.
    update: { name: PART.name, width: PART.width, height: PART.height, shape: PART.shape },
    create: {
      ...PART,
      enabled: false,
      sortOrder: (await prisma.part.count()) || 0,
    },
  });

  const palette = await prisma.palette.upsert({
    where: { name: PALETTE_NAME },
    update: {},
    create: {
      name: PALETTE_NAME,
      enabled: false,
      sortOrder: (await prisma.palette.count()) || 0,
    },
  });

  // Additive by seller code: never rewrite or delete a Color, because that
  // would cascade-delete the inventory rows attached to it.
  const existing = await prisma.color.findMany({
    where: { paletteId: palette.id },
    select: { code: true },
  });
  const have = new Set(existing.map((c) => c.code));
  const missing = COLORS.map(([code, name, hex], i) => ({ code, name, hex, sortOrder: i }))
    .filter((c) => !have.has(c.code));
  if (missing.length) {
    await prisma.color.createMany({
      data: missing.map((c) => ({ paletteId: palette.id, ...c, ...rgb(c.hex) })),
    });
  }

  // One stock line per color for the round part; existing lines are untouched.
  const colors = await prisma.color.findMany({ where: { paletteId: palette.id } });
  const stocked = await prisma.inventoryItem.findMany({
    where: { partId: part.id, colorId: { in: colors.map((c) => c.id) } },
    select: { colorId: true },
  });
  const stockedIds = new Set(stocked.map((s) => s.colorId));
  const toStock = colors.filter((c) => !stockedIds.has(c.id));
  if (toStock.length) {
    await prisma.inventoryItem.createMany({
      data: toStock.map((c) => ({
        partId: part.id,
        colorId: c.id,
        quantity: INITIAL_QUANTITY,
        grams: Math.round(INITIAL_QUANTITY * (part.weightGrams ?? 0) * 100) / 100,
      })),
    });
  }

  const extra = [];
  for (const { partId, codes, quantity } of EXTRA_STOCK) {
    const other = await prisma.part.findUnique({ where: { partId } });
    if (!other) {
      extra.push(`${partId} missing (run seed-bases.mjs first)`);
      continue;
    }
    let added = 0;
    for (const color of colors.filter((c) => codes.includes(c.code))) {
      const key = { partId_colorId: { partId: other.id, colorId: color.id } };
      if (await prisma.inventoryItem.findUnique({ where: key })) continue;
      await prisma.inventoryItem.create({
        data: {
          partId: other.id,
          colorId: color.id,
          quantity,
          grams: Math.round(quantity * (other.weightGrams ?? 0) * 100) / 100,
        },
      });
      added++;
    }
    extra.push(`${partId} +${added} rows`);
  }

  console.log(
    `Yusin Chen seed: part ${PART.partId} (${part.enabled ? "enabled" : "disabled"}), ` +
      `palette "${PALETTE_NAME}" +${missing.length} colors (${colors.length} total), ` +
      `+${toStock.length} inventory rows at ${INITIAL_QUANTITY} pcs; ${extra.join(", ")}.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
