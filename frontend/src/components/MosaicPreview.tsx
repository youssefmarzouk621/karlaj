"use client";

import { memo, useRef, useEffect } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

// Memoized since callers (e.g. the cart, which renders one of these per line
// item) can re-render for unrelated reasons; skip redoing the canvas work
// when gridRows/gridCols/placements/colorMap are all referentially unchanged.
function MosaicPreview({ gridRows, gridCols, placements, colorMap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawMosaic(canvas, { gridRows, gridCols, placements, colorMap });
  }, [placements, colorMap, gridRows, gridCols]);

  return (
    <div className="overflow-hidden rounded-xl border border-border-custom bg-surface p-2">
      <canvas
        ref={canvasRef}
        className="mx-auto block w-full h-auto"
        style={{ aspectRatio: `${gridCols} / ${gridRows}` }}
      />
    </div>
  );
}

export default memo(MosaicPreview);
