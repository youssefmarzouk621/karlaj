// The one place that knows how a mosaic looks in 2D. Shared by drawMosaic.ts
// (DOM <canvas>, client previews) and server/renderMosaicImage.ts
// (@napi-rs/canvas, stored artwork images), so the two can't drift apart.

export interface PaintPlacement {
  color_id: number;
  row: number;
  col: number;
  brick_width: number;
  brick_height: number;
  /** BrickLink part id, e.g. "3024" (square 1x1) or "4073" (round 1x1). */
  part_id?: string;
  /** From the generator (the part's `shape` in the dashboard). */
  shape?: "round" | "square";
}

/** What shows between round plates: the black base plate underneath. */
export const BASE_RGB: [number, number, number] = [20, 20, 20];

// Artworks saved before placements carried `shape` only have the part id.
const ROUND_PART_IDS = new Set(["4073"]);

export function isRound(p: PaintPlacement): boolean {
  if (p.shape) return p.shape === "round";
  return p.part_id ? ROUND_PART_IDS.has(p.part_id) : false;
}

/**
 * The subset of the 2D context API used here, satisfied by both the DOM's
 * CanvasRenderingContext2D and @napi-rs/canvas's context.
 */
export interface Ctx2D {
  fillStyle: unknown;
  strokeStyle: unknown;
  lineWidth: number;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  arc(x: number, y: number, r: number, start: number, end: number): void;
  fill(): void;
  stroke(): void;
}

const rgbCss = (rgb: [number, number, number]) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

/**
 * Paints the mosaic at `cellSize` px per stud from (0, 0).
 *
 * Square plates: filled brick, faint outline, a stud ring per cell.
 * Round plates: a disc per stud on the black base, with its stud ring — the
 * base showing through between the pieces is a large part of how a
 * round-plate mosaic actually looks.
 */
export function paintMosaic(
  ctx: Ctx2D,
  opts: {
    gridRows: number;
    gridCols: number;
    placements: PaintPlacement[];
    colorMap: Record<number, [number, number, number]>;
    cellSize: number;
  }
): void {
  const { gridRows, gridCols, placements, colorMap, cellSize } = opts;

  if (placements.some(isRound)) {
    ctx.fillStyle = rgbCss(BASE_RGB);
    ctx.fillRect(0, 0, gridCols * cellSize, gridRows * cellSize);
  }

  const studRing = (cx: number, cy: number) => {
    ctx.beginPath();
    ctx.arc(cx, cy, cellSize * 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = Math.max(0.5, cellSize * 0.05);
    ctx.stroke();
  };

  for (const p of placements) {
    const rgb = colorMap[p.color_id];
    if (!rgb) continue;

    const x = p.col * cellSize;
    const y = p.row * cellSize;

    if (isRound(p)) {
      for (let dr = 0; dr < p.brick_height; dr++) {
        for (let dc = 0; dc < p.brick_width; dc++) {
          const cx = x + dc * cellSize + cellSize / 2;
          const cy = y + dr * cellSize + cellSize / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, cellSize * 0.46, 0, Math.PI * 2);
          ctx.fillStyle = rgbCss(rgb);
          ctx.fill();
          studRing(cx, cy);
        }
      }
      continue;
    }

    const w = p.brick_width * cellSize;
    const h = p.brick_height * cellSize;
    ctx.fillStyle = rgbCss(rgb);
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = "rgba(0,0,0,0.2)";
    ctx.lineWidth = Math.max(0.5, cellSize * 0.08);
    ctx.strokeRect(x, y, w, h);

    for (let dr = 0; dr < p.brick_height; dr++) {
      for (let dc = 0; dc < p.brick_width; dc++) {
        studRing(x + dc * cellSize + cellSize / 2, y + dr * cellSize + cellSize / 2);
      }
    }
  }
}
