"use client";

import { useEffect, useState } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";
import { getFrameMockups } from "@/lib/frameMockups";

export { hasFrameMockups } from "@/lib/frameMockups";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

export default function FrameMockups({
  gridRows,
  gridCols,
  placements,
  colorMap,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const frames = getFrameMockups(gridCols, gridRows);

  // Render the mosaic once to a data URL, reused across the frames. Deferred a
  // frame so the photos paint first and the setState isn't synchronous.
  useEffect(() => {
    if (placements.length === 0) return;
    const raf = requestAnimationFrame(() => {
      const canvas = document.createElement("canvas");
      drawMosaic(canvas, { gridRows, gridCols, placements, colorMap, width: 512 });
      setSrc(canvas.toDataURL("image/png"));
    });
    return () => cancelAnimationFrame(raf);
  }, [gridRows, gridCols, placements, colorMap]);

  if (frames.length === 0) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {frames.map((f) => (
        <figure key={f.src} className="m-0">
          <div className="relative overflow-hidden rounded-2xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={f.src}
              alt={`Your mosaic framed in a ${f.label.toLowerCase()} setting`}
              className="block w-full"
            />
            {src && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src}
                alt=""
                aria-hidden="true"
                className="absolute bg-white"
                style={{
                  left: `${f.rect.left}%`,
                  top: `${f.rect.top}%`,
                  width: `${f.rect.width}%`,
                  height: `${f.rect.height}%`,
                  objectFit: "fill",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.28)",
                }}
              />
            )}
          </div>
          <figcaption className="mt-1.5 text-center text-xs text-ink-2">
            {f.label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
