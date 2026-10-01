// Idempotent seed for the mosaic configuration tables. Reproduces the current
// hardcoded behavior: the 6 size presets, the 33-color BrickLink palette
// (enabled), the 7 plate parts (1x1 capped at 0.35), and — if the supplier CSV
// is present — the 84-color Alibaba palette as a disabled second option.
//
// Run: npm run db:seed   (after `npm run db:push`)

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const __dirname = dirname(fileURLToPath(import.meta.url));

const hex = (r, g, b) =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase();

// --- sizes (studs) --------------------------------------------------------
const SIZES = [
  { width: 16, height: 16 },
  { width: 32, height: 32 },
  { width: 48, height: 48 },
  { width: 64, height: 64 },
  { width: 48, height: 96 },
  { width: 96, height: 96 },
];

// --- parts (BrickLink plate ids) -----------------------------------------
// variable on the 1x1 part = max fraction of the artwork that may be 1x1.
// weightGrams = approximate weight of one piece (editable in the dashboard);
// used to convert between inventory piece counts and purchased weight.
const PARTS = [
  { name: "1x1 Plate", partId: "3024", width: 1, height: 1, variable: 0.35, weightGrams: 0.2 },
  { name: "1x2 Plate", partId: "3023", width: 1, height: 2, variable: null, weightGrams: 0.4 },
  { name: "1x3 Plate", partId: "3623", width: 1, height: 3, variable: null, weightGrams: 0.5 },
  { name: "1x4 Plate", partId: "3710", width: 1, height: 4, variable: null, weightGrams: 0.7 },
  { name: "2x2 Plate", partId: "3022", width: 2, height: 2, variable: null, weightGrams: 0.8 },
  { name: "2x3 Plate", partId: "3021", width: 2, height: 3, variable: null, weightGrams: 1.1 },
  { name: "2x4 Plate", partId: "3020", width: 2, height: 4, variable: null, weightGrams: 1.4 },
];

// --- BrickLink Classic palette (33 colors) --------------------------------
const BRICKLINK = [
  ["White", 255, 255, 255], ["Light Bluish Gray", 175, 181, 199],
  ["Dark Bluish Gray", 89, 93, 96], ["Black", 33, 33, 33],
  ["Dark Red", 106, 14, 21], ["Red", 179, 0, 6], ["Reddish Brown", 88, 42, 18],
  ["Tan", 222, 198, 156], ["Dark Tan", 144, 116, 80], ["Medium Nougat", 227, 160, 91],
  ["Dark Orange", 179, 84, 8], ["Orange", 255, 126, 20], ["Bright Light Orange", 247, 186, 48],
  ["Yellow", 247, 209, 23], ["Bright Light Yellow", 241, 225, 103], ["Yellowish Green", 223, 238, 165],
  ["Lime", 166, 202, 85], ["Olive Green", 127, 143, 86], ["Dark Green", 46, 85, 67],
  ["Green", 0, 100, 46], ["Bright Green", 16, 203, 49], ["Dark Turquoise", 0, 138, 128],
  ["Dark Blue", 20, 48, 68], ["Blue", 0, 87, 166], ["Dark Azure", 73, 151, 250],
  ["Medium Azure", 95, 189, 247], ["Medium Blue", 97, 175, 255], ["Bright Light Blue", 164, 194, 230],
  ["Sand Blue", 90, 113, 132], ["Dark Purple", 95, 38, 131], ["Medium Lavender", 136, 94, 158],
  ["Dark Pink", 200, 112, 128], ["Bright Pink", 255, 187, 255],
];

// --- external neutrals ----------------------------------------------------
// The PX supplier range carries no white, no black and no light neutral: its
// L* runs 16–84 (photos run 0–100) and every light color is saturated. Without
// these, nearest-color matching sends every white in a photo to a tinted brick
// — a white studio shot renders lavender, white poster text vanishes into a
// beige background. They are NOT supplier stock, so they're flagged
// `external: true` and must be sourced separately.
const NEUTRALS = [
  { name: "White", code: "NEU-W", r: 245, g: 245, b: 243 },
  { name: "Light Gray", code: "NEU-LG", r: 200, g: 200, b: 198 },
  { name: "Mid Gray", code: "NEU-MG", r: 128, g: 128, b: 127 },
  { name: "Black", code: "NEU-BK", r: 26, g: 26, b: 26 },
];

/// Add any missing external neutrals to a palette. Idempotent and additive —
/// it never deletes or rewrites a Color, because that would cascade-delete the
/// inventory rows attached to it.
async function ensureExternalNeutrals(paletteId) {
  const existing = await prisma.color.findMany({
    where: { paletteId },
    select: { code: true, sortOrder: true },
  });
  const have = new Set(existing.map((c) => c.code));
  const missing = NEUTRALS.filter((n) => !have.has(n.code));
  if (missing.length === 0) return 0;

  let sortOrder = Math.max(0, ...existing.map((c) => c.sortOrder)) + 1;
  await prisma.color.createMany({
    data: missing.map((n) => ({
      paletteId,
      name: n.name,
      code: n.code,
      hex: hex(n.r, n.g, n.b),
      r: n.r,
      g: n.g,
      b: n.b,
      external: true,
      sortOrder: sortOrder++,
    })),
  });
  return missing.length;
}

async function seedPalette(name, enabled, sortOrder, colors) {
  const palette = await prisma.palette.upsert({
    where: { name },
    // `enabled` is deliberately not in `update`: which palette is live is an
    // operational choice made in the dashboard, and re-seeding must not switch
    // it back (that silently changes the colors of every mosaic generated next).
    update: { sortOrder },
    create: { name, enabled, sortOrder },
  });
  // Only seed colors for a brand-new palette. Re-seeding must NOT rewrite colors,
  // because deleting a Color cascade-deletes its inventory_items rows — real stock
  // must survive `npm run db:seed`. Existing palettes keep their (edited) colors.
  const existing = await prisma.color.count({ where: { paletteId: palette.id } });
  if (existing === 0) {
    await prisma.color.createMany({
      data: colors.map((c, i) => ({ paletteId: palette.id, sortOrder: i, ...c })),
    });
  }
  return palette;
}

// Optional: load the supplier's 84-color palette from the CSV, if present.
function loadSellerColors() {
  try {
    const csv = readFileSync(
      join(__dirname, "..", "..", "mosaic-generator", "seller_colors_full.csv"),
      "utf8"
    );
    const rows = csv.trim().split(/\r?\n/).slice(1); // skip header
    return rows.map((line) => {
      // seller_code,rgb,hex   (rgb is "r g b")
      const [code, rgb, hx] = line.split(",");
      const [r, g, b] = rgb.trim().split(/\s+/).map(Number);
      return { name: code, code, hex: hx.trim(), r, g, b };
    });
  } catch {
    return null;
  }
}

async function main() {
  // sizes
  for (let i = 0; i < SIZES.length; i++) {
    const s = SIZES[i];
    await prisma.mosaicSize.upsert({
      where: { width_height: { width: s.width, height: s.height } },
      update: { enabled: true, sortOrder: i },
      create: { ...s, enabled: true, sortOrder: i },
    });
  }

  // parts
  for (let i = 0; i < PARTS.length; i++) {
    const p = PARTS[i];
    await prisma.part.upsert({
      where: { partId: p.partId },
      // `enabled` is deliberately not in `update`: which parts are live is
      // chosen in the dashboard (e.g. round-only), and re-seeding must not
      // switch the square plates back on.
      update: {
        name: p.name,
        width: p.width,
        height: p.height,
        variable: p.variable,
        weightGrams: p.weightGrams,
        sortOrder: i,
      },
      create: { ...p, enabled: true, sortOrder: i },
    });
  }

  // palettes
  await seedPalette(
    "BrickLink Classic",
    true,
    0,
    BRICKLINK.map(([name, r, g, b]) => ({ name, hex: hex(r, g, b), r, g, b, code: null }))
  );

  const seller = loadSellerColors();
  if (seller && seller.length) {
    const px = await seedPalette("Alibaba Supplier (PX)", false, 1, seller);
    const added = await ensureExternalNeutrals(px.id);
    console.log(
      `Seeded supplier palette with ${seller.length} colors` +
        (added ? `, plus ${added} external neutrals.` : " (neutrals already present).")
    );
  }

  console.log(
    `Seed complete: ${SIZES.length} sizes, ${PARTS.length} parts, BrickLink Classic (33 colors, enabled).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
