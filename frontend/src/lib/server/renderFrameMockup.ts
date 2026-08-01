import { createCanvas, loadImage } from "@napi-rs/canvas";
import path from "path";
import type { Placement } from "@/lib/mosaicTypes";
import type { FrameMockup } from "@/lib/frameMockups";
import { renderMosaicPng, type RenderedImage } from "./renderMosaicImage";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

interface MosaicInput {
  gridRows: number;
  gridCols: number;
  placements: Placement[];
  colorMap: Record<number, [number, number, number]>;
}

/**
 * Composites the mosaic into a frame-mockup photo's painted window opening —
 * the server-side counterpart to FrameMockups.tsx's client-side compositing,
 * using the same measured rects (frontend/src/lib/frameMockups.ts) so the
 * result matches what the create-flow result page already shows.
 */
export async function renderFrameMockupPng(
  frame: FrameMockup,
  mosaic: MosaicInput,
  maxDimension: number
): Promise<RenderedImage> {
  const mockupImage = await loadImage(path.join(PUBLIC_ROOT, frame.src));
  const scale = Math.min(1, maxDimension / Math.max(mockupImage.width, mockupImage.height));
  const canvasWidth = Math.round(mockupImage.width * scale);
  const canvasHeight = Math.round(mockupImage.height * scale);

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(mockupImage, 0, 0, canvasWidth, canvasHeight);

  const windowX = Math.round((frame.rect.left / 100) * canvasWidth);
  const windowY = Math.round((frame.rect.top / 100) * canvasHeight);
  const windowWidth = Math.round((frame.rect.width / 100) * canvasWidth);
  const windowHeight = Math.round((frame.rect.height / 100) * canvasHeight);

  const rendered = renderMosaicPng({
    gridRows: mosaic.gridRows,
    gridCols: mosaic.gridCols,
    placements: mosaic.placements,
    colorMap: mosaic.colorMap,
    maxDimension: Math.max(windowWidth, windowHeight),
  });
  const mosaicImage = await loadImage(rendered.buffer);
  ctx.drawImage(mosaicImage, windowX, windowY, windowWidth, windowHeight);

  return { buffer: canvas.toBuffer("image/png"), width: canvasWidth, height: canvasHeight };
}
