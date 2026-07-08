"use client";

import { useCallback, useRef, useState } from "react";
import {
  MAX_STUDS,
  clampStuds,
  sizeCm,
} from "@/components/SizeSelector";

interface Props {
  /** URL of the uploaded photo, or null before one is chosen. */
  preview: string | null;
  width: number;
  height: number;
  onChange: (w: number, h: number) => void;
}

/**
 * Word-style resizable crop preview. The centered box is the mosaic; the square
 * frame around it represents the maximum size (96×96). Dragging any corner
 * handle resizes the box outward/inward from the center, updating the stud
 * count live. Doubles as the crop preview (object-cover, matching the backend's
 * center-crop).
 */
export default function SizePreview({
  preview,
  width,
  height,
  onChange,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // Map the pointer's distance from the frame center to a stud count. The frame
  // is square and its half-extent equals MAX_STUDS from the center each way.
  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const w = clampStuds((Math.abs(clientX - cx) * 2 * MAX_STUDS) / rect.width);
      const h = clampStuds((Math.abs(clientY - cy) * 2 * MAX_STUDS) / rect.height);
      onChange(w, h);
    },
    [onChange]
  );

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    frameRef.current?.setPointerCapture(e.pointerId);
    applyFromPointer(e.clientX, e.clientY);
  };
  const onMove = (e: React.PointerEvent) => {
    if (dragging) applyFromPointer(e.clientX, e.clientY);
  };
  const endDrag = (e: React.PointerEvent) => {
    setDragging(false);
    frameRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const boxStyle = {
    width: `${(width / MAX_STUDS) * 100}%`,
    height: `${(height / MAX_STUDS) * 100}%`,
    transform: "translate(-50%, -50%)",
    transition: dragging ? "none" : "width 0.22s ease, height 0.22s ease",
  };

  const handle =
    "absolute z-10 h-4 w-4 rounded-full border-2 border-accent bg-white shadow " +
    "pointer-events-auto touch-none";

  return (
    <div>
      <p className="text-xs text-muted mb-2">Crop &amp; size — drag any corner</p>

      <div
        ref={frameRef}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto aspect-square w-full max-w-[340px] touch-none select-none rounded-xl border border-dashed border-border-custom bg-surface"
      >
        {/* The mosaic box, centered and resizable. */}
        <div className="absolute left-1/2 top-1/2" style={boxStyle}>
          {/* Clipped crop preview. */}
          <div className="absolute inset-0 overflow-hidden rounded-md ring-2 ring-accent">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Crop preview"
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-muted">
                No image
              </div>
            )}
            <span className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
              {width} × {height} · {sizeCm(width, height)}
            </span>
          </div>

          {/* Corner handles (outside the clip so they aren't cut off). */}
          <div
            onPointerDown={startDrag}
            style={{ cursor: "nwse-resize" }}
            className={`${handle} -left-2 -top-2`}
          />
          <div
            onPointerDown={startDrag}
            style={{ cursor: "nesw-resize" }}
            className={`${handle} -right-2 -top-2`}
          />
          <div
            onPointerDown={startDrag}
            style={{ cursor: "nesw-resize" }}
            className={`${handle} -bottom-2 -left-2`}
          />
          <div
            onPointerDown={startDrag}
            style={{ cursor: "nwse-resize" }}
            className={`${handle} -bottom-2 -right-2`}
          />
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-muted">
        {width} × {height} studs · ~{sizeCm(width, height)}
      </p>
    </div>
  );
}
