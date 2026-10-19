import { paintMosaic, type PaintPlacement } from "@/lib/paintMosaic";

export type DrawPlacement = PaintPlacement;

interface DrawOptions {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
  /** Target pixel width to size the studs from. Defaults to the parent's width. */
  width?: number;
}

/**
 * Draws a brick mosaic onto a canvas, sized to its container. Shared by every
 * client-side preview (framed print, before/after, bags, mockups) so there's
 * one source of truth for how the mosaic looks; the drawing itself lives in
 * paintMosaic.ts, which the server renderer uses too.
 */
export function drawMosaic(canvas: HTMLCanvasElement, opts: DrawOptions): void {
  const { gridRows, gridCols, placements, colorMap } = opts;
  if (placements.length === 0) return;

  const maxWidth = opts.width ?? canvas.parentElement?.clientWidth ?? 600;
  const cellSize = Math.max(2, Math.floor(maxWidth / gridCols));
  canvas.width = gridCols * cellSize;
  canvas.height = gridRows * cellSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  paintMosaic(ctx, { gridRows, gridCols, placements, colorMap, cellSize });
}
