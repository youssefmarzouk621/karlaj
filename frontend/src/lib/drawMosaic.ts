export interface DrawPlacement {
  color_id: number;
  row: number;
  col: number;
  brick_width: number;
  brick_height: number;
}

interface DrawOptions {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
  /** Target pixel width to size the studs from. Defaults to the parent's width. */
  width?: number;
}

/**
 * Draws a brick mosaic (filled bricks, outlines, stud circles) onto a canvas.
 * Shared by MosaicPreview and the before/after slider so there's one source of
 * truth for how the mosaic looks.
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

  for (const p of placements) {
    const rgb = colorMap[p.color_id];
    if (!rgb) continue;

    const x = p.col * cellSize;
    const y = p.row * cellSize;
    const w = p.brick_width * cellSize;
    const h = p.brick_height * cellSize;

    // Fill brick
    ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
    ctx.fillRect(x, y, w, h);

    // Brick outline
    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(0.5, cellSize * 0.08);
    ctx.strokeRect(x, y, w, h);

    // Stud circle per cell
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
}
