// Idempotent seed for the SMARTABLE AliExpress supplier line: the 1x1 round
// plate part (4073), its 53-color palette, and one inventory row per color.
//
// Source listing (4600 pcs/lot per color, 4073/6141):
//   https://fr.aliexpress.com/item/1005005225591314.html
//
// The seller's numeric swatch codes are official LEGO color ids (26 = Black,
// 21 = Bright Red, 194 = Medium Stone Grey, ...), so those colors use the
// official RGB, named with their BrickLink equivalent. The A*/S* codes are the
// seller's own colors with no LEGO equivalent: their RGB is estimated from the
// listing's swatch photos (color-corrected against the known codes) and should
// be re-measured once physical pieces arrive.
//
// The part is created DISABLED: the generator assumes a single 1x1 part, and
// switching the live palette/part is an operational choice made in the
// dashboard. The palette is created disabled for the same reason.
//
// Run: node seed/seed-smartable-round.mjs   (after `npm run db:push`)

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PALETTE_NAME = "SMARTABLE Round 1x1 (AliExpress)";

// Pieces on hand per color: one lot as sold by the listing. Only applied when
// an inventory row is first created; existing stock is never overwritten.
const INITIAL_QUANTITY = 4600;

const PART = {
  name: "1x1 Round Plate",
  partId: "4073",
  width: 1,
  height: 1,
  variable: null,
  weightGrams: 0.1, // approximate; editable in the dashboard
};

// [seller code, name, hex] in the listing's swatch order.
const COLORS = [
  ["26", "Black", "#05131D"],
  ["01", "White", "#FFFFFF"],
  ["38", "Dark Orange", "#A95500"],
  ["106", "Orange", "#FE8A18"],
  ["323", "Light Aqua", "#ADC3C0"],
  ["05", "Tan", "#E4CD9E"],
  ["18", "Nougat", "#D09168"],
  ["37", "Bright Green", "#4B9F4A"],
  ["148", "Pearl Dark Gray", "#575857"],
  ["191", "Bright Light Orange", "#F8BB3D"],
  ["192", "Reddish Brown", "#582A12"],
  ["194", "Light Bluish Gray", "#A0A5A9"],
  ["312", "Medium Nougat", "#AA7D55"],
  ["315", "Flat Silver", "#898788"],
  ["A08", "A08 Peach", "#FFDCB1"],
  ["A13", "A13 Blue Violet", "#5B58C3"],
  ["A24", "A24 Light Caramel", "#FABD6A"],
  ["A25", "A25 Caramel", "#F2A44C"],
  ["23", "Blue", "#0055BF"],
  ["24", "Yellow", "#F2CD37"],
  ["28", "Green", "#237841"],
  ["102", "Medium Blue", "#5A93DB"],
  ["107", "Dark Turquoise", "#008F9B"],
  ["119", "Lime", "#BBE90B"],
  ["124", "Magenta", "#923978"],
  ["135", "Sand Blue", "#6074A1"],
  ["138", "Dark Tan", "#958A73"],
  ["140", "Dark Blue", "#0A3463"],
  ["141", "Dark Green", "#184632"],
  ["151", "Sand Green", "#A0BCAC"],
  ["199", "Dark Bluish Gray", "#6C6E68"],
  ["212", "Bright Light Blue", "#9FC3E9"],
  ["221", "Dark Pink", "#C870A0"],
  ["222", "Bright Pink", "#E4ADC8"],
  ["226", "Bright Light Yellow", "#FFF03A"],
  ["268", "Dark Purple", "#3F3691"],
  ["283", "Light Nougat", "#F6D7B3"],
  ["21", "Red", "#C91A09"],
  ["297", "Pearl Gold", "#AA7F2E"],
  ["308", "Dark Brown", "#352100"],
  ["321", "Dark Azure", "#078BC9"],
  ["322", "Medium Azure", "#36AEBF"],
  ["127", "Metallic Gold", "#DBAC34"],
  ["324", "Medium Lavender", "#AC78BA"],
  ["325", "Lavender", "#E1D5ED"],
  ["326", "Yellowish Green", "#DFEEA5"],
  ["330", "Olive Green", "#9B9A5A"],
  ["353", "Coral", "#FF698F"],
  ["A29", "A29 Charcoal", "#364441"],
  ["S01", "S01 Dark Olive", "#5C6A2F"],
  ["S04", "S04 Steel Blue", "#52A7CD"],
  ["S10", "S10 Raspberry", "#F05F8A"],
  ["154", "Dark Red", "#720E0F"],
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
    update: { name: PART.name, width: PART.width, height: PART.height },
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

  console.log(
    `SMARTABLE seed: part ${PART.partId} (${part.enabled ? "enabled" : "disabled"}), ` +
      `palette "${PALETTE_NAME}" +${missing.length} colors (${colors.length} total), ` +
      `+${toStock.length} inventory rows at ${INITIAL_QUANTITY} pcs.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
