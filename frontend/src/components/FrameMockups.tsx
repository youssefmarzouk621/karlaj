"use client";

import { useEffect, useState } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

interface Frame {
  src: string;
  label: string;
  rect: { left: number; top: number; width: number; height: number };
}

/**
 * Photo frame mockups, keyed by mosaic size. Each frame photo has a painted
 * "empty" window (no real transparency), so we render the mosaic and lay it
 * exactly over that opening — the frame border stays visible around it. Opening
 * rectangles were measured from the PNGs (frontend/public/mockups), as a
 * percentage of the image, with a small overscan so no window edge peeks out.
 */
const FRAME_SETS: Record<string, Frame[]> = {
  "32x32": [
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
  ],
  "64x64": [
    {
      src: "/mockups/1_mockup_64x64.png",
      label: "Living room",
      rect: { left: 29.8, top: 18.1, width: 42.3, height: 42.3 },
    },
    {
      src: "/mockups/2_mockup_64x64.png",
      label: "Console shelf",
      rect: { left: 26.2, top: 19.0, width: 48.3, height: 48.3 },
    },
  ],
};

/** Whether a photo-frame mockup set exists for this size. */
export function hasFrameMockups(width: number, height: number): boolean {
  return `${width}x${height}` in FRAME_SETS;
}

export default function FrameMockups({
  gridRows,
  gridCols,
  placements,
  colorMap,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const frames = FRAME_SETS[`${gridCols}x${gridRows}`] ?? [];

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
