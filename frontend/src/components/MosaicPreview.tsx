"use client";

import { useRef, useEffect } from "react";

interface Placement {
  color_id: number;
  row: number;
  col: number;
  brick_width: number;
  brick_height: number;
}

interface Props {
  gridRows: number;
  gridCols: number;
  placements: Placement[];
  colorMap: Record<number, [number, number, number]>;
}

export default function MosaicPreview({
  gridRows,
  gridCols,
  placements,
  colorMap,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || placements.length === 0) return;

    const maxWidth = canvas.parentElement?.clientWidth ?? 600;
    const cellSize = Math.max(2, Math.floor(maxWidth / gridCols));
    canvas.width = gridCols * cellSize;
    canvas.height = gridRows * cellSize;

    const ctx = canvas.getContext("2d")!;
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

      // Draw stud circles for each cell in the brick
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
  }, [placements, colorMap, gridRows, gridCols]);

  return (
    <div className="overflow-auto rounded-xl border border-border-custom bg-surface p-2">
      <canvas ref={canvasRef} className="mx-auto block" />
    </div>
  );
}
