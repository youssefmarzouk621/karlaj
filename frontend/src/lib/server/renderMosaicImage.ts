import { createCanvas } from "@napi-rs/canvas";
import type { Placement } from "@/lib/mosaicTypes";
import { paintMosaic } from "@/lib/paintMosaic";

// Server-side counterpart to drawMosaic.ts (which draws on a DOM <canvas> and
// is sized to whatever container it's dropped into client-side). This runs
// once, at artwork-creation time, at a size chosen for the image's purpose
// rather than shrunk to fit a small preview box — the actual "high fidelity"
// fix. The drawing itself is paintMosaic.ts, shared with drawMosaic.ts, so it
// looks exactly like the mosaic shown elsewhere in the app (round plates too).
interface RenderOptions {
  gridRows: number;
  gridCols: number;
  placements: Placement[];
  colorMap: Record<number, [number, number, number]>;
  /** Longest edge of the output image, in pixels. */
  maxDimension: number;
}

export interface RenderedImage {
  buffer: Buffer;
  width: number;
  height: number;
}

export function renderMosaicPng(opts: RenderOptions): RenderedImage {
  const { gridRows, gridCols, placements, colorMap, maxDimension } = opts;
  const cellSize = Math.max(2, Math.floor(maxDimension / Math.max(gridCols, gridRows)));
  const width = gridCols * cellSize;
  const height = gridRows * cellSize;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, width, height);
  paintMosaic(ctx, { gridRows, gridCols, placements, colorMap, cellSize });

  return { buffer: canvas.toBuffer("image/png"), width, height };
}
