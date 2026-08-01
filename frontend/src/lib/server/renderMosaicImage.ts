import { createCanvas } from "@napi-rs/canvas";
import type { Placement } from "@/lib/mosaicTypes";

// Server-side counterpart to drawMosaic.ts (which draws on a DOM <canvas> and
// is sized to whatever container it's dropped into client-side). This runs
// once, at artwork-creation time, at a size chosen for the image's purpose
// rather than shrunk to fit a small preview box — the actual "high fidelity"
// fix. Same visual style (filled bricks, outline, stud circles) so it still
// looks like the mosaic shown elsewhere in the app.
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

  for (const p of placements) {
    const rgb = colorMap[p.color_id];
    if (!rgb) continue;

    const x = p.col * cellSize;
    const y = p.row * cellSize;
    const w = p.brick_width * cellSize;
    const h = p.brick_height * cellSize;

    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(0.5, cellSize * 0.08);
    ctx.strokeRect(x, y, w, h);

    for (let dr = 0; dr < p.brick_height; dr++) {
      for (let dc = 0; dc < p.brick_width; dc++) {
        ctx.beginPath();
        ctx.arc(
          x + dc * cellSize + cellSize / 2,
          y + dr * cellSize + cellSize / 2,
          cellSize * 0.3,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = Math.max(0.5, cellSize * 0.05);
        ctx.stroke();
      }
    }
  }

  return { buffer: canvas.toBuffer("image/png"), width, height };
}
