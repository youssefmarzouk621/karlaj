// Loads homepage images into the `site_images` table (what the dashboard's
// "Homepage images" page edits), from a folder of files named after the slots
// in src/siteImages.ts: compare_before.jpg, gallery_1.png, ... Only the slots
// that have a file are touched.
//
// Optional `captions.json` in the same folder: { "<slot>": { "alt", "title", "meta" } }.
//
// Run: node seed/seed-site-images.mjs <folder>
//   (after `npm run db:push`). The image files themselves aren't kept in the
//   repo — use only images you have the rights to.

import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const SLOTS = [
  "compare_before", "compare_after", "preview_3d", "sizes_art",
  "gallery_1", "gallery_2", "gallery_3", "gallery_4",
];

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node seed/seed-site-images.mjs <folder with <slot>.png|jpg|webp files>");
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const files = await readdir(dir);
  const captions = files.includes("captions.json")
    ? JSON.parse(await readFile(join(dir, "captions.json"), "utf8"))
    : {};

  for (const slot of SLOTS) {
    const file = files.find((f) => f.startsWith(`${slot}.`) && MIME[extname(f).toLowerCase()]);
    if (!file) continue;
    const data = await readFile(join(dir, file));
    const c = captions[slot] ?? {};
    const fields = { alt: c.alt ?? "", title: c.title ?? "", meta: c.meta ?? "" };
    await prisma.siteImage.upsert({
      where: { slot },
      create: { slot, mimeType: MIME[extname(file).toLowerCase()], data, ...fields },
      update: { mimeType: MIME[extname(file).toLowerCase()], data, ...fields },
    });
    console.log(`${slot}: ${file} (${(data.length / 1024).toFixed(0)} KB)`);
  }
}

main().finally(() => prisma.$disconnect());
