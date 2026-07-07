"use client";

import { useRef, useEffect } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
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
    if (!canvas) return;
    drawMosaic(canvas, { gridRows, gridCols, placements, colorMap });
  }, [placements, colorMap, gridRows, gridCols]);

  return (
    <div className="overflow-auto rounded-xl border border-border-custom bg-surface p-2">
      <canvas ref={canvasRef} className="mx-auto block" />
    </div>
  );
}
