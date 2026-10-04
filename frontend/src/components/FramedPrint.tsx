"use client";

import { useEffect, useRef } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

/** The finished mosaic as a framed print on a gallery wall. */
export default function FramedPrint({ gridRows, gridCols, placements, colorMap }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawMosaic(canvas, { gridRows, gridCols, placements, colorMap, width: 900 });
  }, [gridRows, gridCols, placements, colorMap]);

  return (
    <div className="absolute inset-0 grid place-items-center p-6 pt-24 bg-gradient-to-b from-[#E6E2DB] to-[#D6D1C9]">
      <div className="bg-[#1B1916] p-3.5 shadow-art max-w-full">
        <div className="bg-[#FBFAF8] p-6 md:p-11">
          {/* The test id marks the one plain 2D render of the generated mosaic (see BeforeAfterSlider). */}
          <canvas
            ref={canvasRef}
            data-testid="mosaic-canvas"
            aria-label="Your mosaic, framed"
            className="block h-auto"
            style={{ width: `min(440px, 62vw, ${(520 * gridCols) / Math.max(gridRows, 1)}px)` }}
          />
        </div>
      </div>
    </div>
  );
}
