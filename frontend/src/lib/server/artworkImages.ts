import { mkdir, writeFile } from "fs/promises";
import path from "path";
import type { ArtworkImageKind } from "@lego/database";
import type { Part, Placement } from "@/lib/mosaicTypes";
import { getFrameMockups } from "@/lib/frameMockups";
import { renderMosaicPng, type RenderedImage } from "./renderMosaicImage";
import { renderFrameMockupPng } from "./renderFrameMockup";

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const ASSETS_BASE_URL = (process.env.ASSETS_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const MAIN_MAX_DIMENSION = 2000;

// PREVIEW_1/PREVIEW_2 map onto whichever frame-mockup photos exist for this
// size (frontend/public/mockups/, via frameMockups.ts) — the mosaic
// composited into the frame's window, same as the create-flow result page.
// Sizes with no mockup set fall back to a plain, smaller flat render.
const PREVIEW_SLOTS: { kind: ArtworkImageKind; filename: string; maxDimension: number }[] = [
  { kind: "PREVIEW_1", filename: "preview1.png", maxDimension: 700 },
  { kind: "PREVIEW_2", filename: "preview2.png", maxDimension: 350 },
];

export interface GeneratedArtworkImage {
  kind: ArtworkImageKind;
  url: string;
  width: number;
  height: number;
}

/**
 * Renders the MAIN + PREVIEW_1 + PREVIEW_2 PNGs for a freshly created
 * artwork, writes them to `public/uploads/<artworkId>/`, and returns rows
 * ready to insert as ArtworkImage records (full HTTP URLs, not paths).
 */
export async function generateArtworkImages(
  artworkId: string,
  mosaic: { width: number; height: number; placements: Placement[]; partsList: Part[] }
): Promise<GeneratedArtworkImage[]> {
  const colorMap: Record<number, [number, number, number]> = {};
  for (const p of mosaic.partsList) colorMap[p.color_id] = p.rgb;

  const dir = path.join(UPLOADS_ROOT, artworkId);
  await mkdir(dir, { recursive: true });

  const write = async (kind: ArtworkImageKind, filename: string, rendered: RenderedImage) => {
    await writeFile(path.join(dir, filename), rendered.buffer);
    return {
      kind,
      url: `${ASSETS_BASE_URL}/uploads/${artworkId}/${filename}`,
      width: rendered.width,
      height: rendered.height,
    };
  };

  const images: GeneratedArtworkImage[] = [];

  const main = renderMosaicPng({
    gridRows: mosaic.height,
    gridCols: mosaic.width,
    placements: mosaic.placements,
    colorMap,
    maxDimension: MAIN_MAX_DIMENSION,
  });
  images.push(await write("MAIN", "image.png", main));

  const frames = getFrameMockups(mosaic.width, mosaic.height);
  for (const [i, slot] of PREVIEW_SLOTS.entries()) {
    const frame = frames[i];
    const rendered = frame
      ? await renderFrameMockupPng(
          frame,
          {
            gridRows: mosaic.height,
            gridCols: mosaic.width,
            placements: mosaic.placements,
            colorMap,
          },
          slot.maxDimension
        )
      : renderMosaicPng({
          gridRows: mosaic.height,
          gridCols: mosaic.width,
          placements: mosaic.placements,
          colorMap,
          maxDimension: slot.maxDimension,
        });
    images.push(await write(slot.kind, slot.filename, rendered));
  }

  return images;
}
