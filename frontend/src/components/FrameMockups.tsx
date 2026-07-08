"use client";

import { useEffect, useState } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

/**
 * Photo frame mockups for the 32×32 kit. Each frame photo has a painted "empty"
 * window (no real transparency), so we render the mosaic and lay it exactly over
 * that opening — the frame border stays visible around it. Opening rectangles
 * were measured from the PNGs (frontend/public/mockups) and are expressed as a
 * percentage of the image, with a small overscan so no window edge peeks out.
 */
const FRAMES = [
  {
    src: "/mockups/1_mockup_32x32.png",
    label: "Living room",
    rect: { left: 23.8, top: 17.3, width: 34.2, height: 34.0 },
  },
  {
    src: "/mockups/2_mockup_32x32.png",
    label: "Kitchen shelf",
    rect: { left: 28.3, top: 16.1, width: 64.4, height: 67.2 },
  },
];

export default function FrameMockups({
  gridRows,
  gridCols,
  placements,
  colorMap,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);

  // Render the mosaic once to a data URL, reused in both frames. Deferred a
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

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {FRAMES.map((f) => (
        <figure key={f.src} className="m-0">
          <div className="relative overflow-hidden rounded-xl border border-border-custom">
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
          <figcaption className="mt-1.5 text-center text-xs text-muted">
            {f.label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
