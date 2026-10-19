"use client";

import { useCallback, useRef, useState } from "react";
import { objectPosition, type CropPosition } from "@/lib/crop";
import {
  MAX_STUDS,
  MIN_STUDS,
  clampStuds,
  sizeCm,
  type SizeOption,
} from "@/components/SizeSelector";

interface Props {
  /** URL of the uploaded photo, or null before one is chosen. */
  preview: string | null;
  width: number;
  height: number;
  /** Largest stud dimension the frame represents (the biggest enabled size). */
  maxStud?: number;
  /** When false, dragging snaps to the nearest enabled size instead of resizing freely. */
  customSizeEnabled: boolean;
  /** The enabled preset sizes to snap to when custom sizing is off. */
  enabledSizes: SizeOption[];
  onChange: (w: number, h: number) => void;
  /** The photo's width / height (needed to turn a drag into a crop offset). */
  photoAspect?: number | null;
  /** Where the crop window sits on the photo; dragging inside the box moves it. */
  crop: CropPosition;
  onCropChange: (crop: CropPosition) => void;
}

/**
 * Word-style resizable crop preview. The centered box is the mosaic; the square
 * frame around it represents the maximum enabled size. Dragging any corner
 * handle resizes the box outward/inward from the center, updating the stud
 * count live. Doubles as the crop preview (object-cover + object-position,
 * matching the generator's crop_to_ratio): dragging inside the box slides the
 * photo to choose which part of it is kept.
 */
export default function SizePreview({
  preview,
  width,
  height,
  maxStud = MAX_STUDS,
  customSizeEnabled,
  enabledSizes,
  onChange,
  photoAspect,
  crop,
  onCropChange,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const panRef = useRef<{ x: number; y: number; crop: CropPosition } | null>(null);

  // Map the pointer's distance from the frame center to a stud count. The frame
  // is square and its half-extent equals maxStud from the center each way.
  const applyFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const rect = frameRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const w = clampStuds((Math.abs(clientX - cx) * 2 * maxStud) / rect.width, MIN_STUDS, maxStud);
      const h = clampStuds((Math.abs(clientY - cy) * 2 * maxStud) / rect.height, MIN_STUDS, maxStud);

      // Custom sizing off → snap to the nearest enabled preset (drag up/down
      // through the available sizes) instead of resizing freely.
      if (!customSizeEnabled && enabledSizes.length) {
        let best = enabledSizes[0];
        let bestDist = Infinity;
        for (const s of enabledSizes) {
          const d = (s.width - w) ** 2 + (s.height - h) ** 2;
          if (d < bestDist) {
            bestDist = d;
            best = s;
          }
        }
        onChange(best.width, best.height);
        return;
      }

      onChange(w, h);
    },
    [onChange, maxStud, customSizeEnabled, enabledSizes]
  );

  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
    frameRef.current?.setPointerCapture(e.pointerId);
    applyFromPointer(e.clientX, e.clientY);
  };
  // Panning: the photo is object-cover inside the box, so it overflows along
  // one axis by (rendered size − box size). Dragging by d px moves the crop by
  // d / overflow of the way across — and the photo follows the pointer, so the
  // crop window moves the opposite way.
  const startPan = (e: React.PointerEvent) => {
    if (!photoAspect) return;
    e.preventDefault();
    panRef.current = { x: e.clientX, y: e.clientY, crop };
    frameRef.current?.setPointerCapture(e.pointerId);
  };
  const applyPan = (clientX: number, clientY: number) => {
    const start = panRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (!start || !box || !photoAspect || box.width === 0) return;
    const boxAspect = box.width / box.height;
    const overflowX = photoAspect > boxAspect ? box.height * photoAspect - box.width : 0;
    const overflowY = photoAspect < boxAspect ? box.width / photoAspect - box.height : 0;
    const clamp = (v: number) => Math.min(1, Math.max(0, v));
    onCropChange({
      x: overflowX > 0 ? clamp(start.crop.x - (clientX - start.x) / overflowX) : start.crop.x,
      y: overflowY > 0 ? clamp(start.crop.y - (clientY - start.y) / overflowY) : start.crop.y,
    });
  };

  const onMove = (e: React.PointerEvent) => {
    if (dragging) applyFromPointer(e.clientX, e.clientY);
    else if (panRef.current) applyPan(e.clientX, e.clientY);
  };
  const endDrag = (e: React.PointerEvent) => {
    setDragging(false);
    panRef.current = null;
    frameRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const boxStyle = {
    width: `${(width / maxStud) * 100}%`,
    height: `${(height / maxStud) * 100}%`,
    transform: "translate(-50%, -50%)",
    transition: dragging ? "none" : "width 0.22s ease, height 0.22s ease",
  };

  const handle =
    "absolute z-10 h-3.5 w-3.5 rounded-full bg-white shadow-md " +
    "pointer-events-auto touch-none";

  return (
    <div className="rounded-[28px] bg-surface-2 p-5 flex flex-col gap-3.5">
      <span className="flex justify-between gap-3 text-[13px] font-semibold">
        Crop
        <span className="font-normal text-ink-2 text-right">Drag corners to resize · drag photo to move</span>
      </span>

      <div
        ref={frameRef}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative mx-auto aspect-square w-full max-w-[420px] touch-none select-none rounded-2xl bg-surface overflow-hidden"
      >
        {/* The whole photo, dimmed, so the crop reads as a window onto it. */}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          />
        )}

        {/* The mosaic box, centered and resizable. */}
        <div ref={boxRef} className="absolute left-1/2 top-1/2" style={boxStyle}>
          {/* Clipped crop preview; drag it to move the crop. */}
          <div
            data-testid="crop-box"
            onPointerDown={startPan}
            className="absolute inset-0 overflow-hidden ring-2 ring-white shadow-[0_0_0_9999px_rgba(17,16,15,.45)] cursor-grab active:cursor-grabbing"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt="Crop preview"
                draggable={false}
                className="pointer-events-none h-full w-full object-cover"
                style={{ objectPosition: objectPosition(crop) }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-ink-2">
                No image
              </div>
            )}
            <span className="pointer-events-none absolute bottom-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[rgba(17,16,15,.7)] backdrop-blur-sm px-2.5 py-1 text-xs font-semibold text-white">
              {width} × {height} · {sizeCm(width, height)}
            </span>
          </div>

          {/* Corner handles (outside the clip so they aren't cut off). */}
          <div onPointerDown={startDrag} style={{ cursor: "nwse-resize" }} className={`${handle} -left-[7px] -top-[7px]`} />
          <div onPointerDown={startDrag} style={{ cursor: "nesw-resize" }} className={`${handle} -right-[7px] -top-[7px]`} />
          <div onPointerDown={startDrag} style={{ cursor: "nesw-resize" }} className={`${handle} -bottom-[7px] -left-[7px]`} />
          <div onPointerDown={startDrag} style={{ cursor: "nwse-resize" }} className={`${handle} -bottom-[7px] -right-[7px]`} />
        </div>
      </div>
    </div>
  );
}
