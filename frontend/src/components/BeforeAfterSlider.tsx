"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";

interface Props {
  /** URL of the original uploaded photo (the "before"). */
  beforeSrc: string;
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * Before/after reveal slider: the LEGO mosaic sits underneath, the original
 * photo is clipped on top. On mount it plays an intro wipe (photo → reveal the
 * mosaic → settle to the middle); after that the user can drag the divider to
 * compare freely.
 */
export default function BeforeAfterSlider({
  beforeSrc,
  gridRows,
  gridCols,
  placements,
  colorMap,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);

  // `pos` = % of the width showing the "before" photo (100 = all photo, 0 = all mosaic).
  const [pos, setPos] = useState(100);
  const [animating, setAnimating] = useState(true);

  // Render the mosaic underneath.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawMosaic(canvas, { gridRows, gridCols, placements, colorMap, width: 900 });
  }, [gridRows, gridCols, placements, colorMap]);

  // Intro wipe. Runs once on mount; the parent remounts (via `key`) for a new
  // result, which replays it. State starts at { pos: 100, animating: true }, so
  // the effect only schedules the async steps — no synchronous setState here.
  useEffect(() => {
    const wipe = setTimeout(() => setPos(0), 450); // sweep across to fully reveal the mosaic
    const settle = setTimeout(() => setPos(9), 1550); // ease the handle just inside the left edge
    return () => {
      clearTimeout(wipe);
      clearTimeout(settle);
    };
  }, []);

  const setFromClientX = useCallback((clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    setAnimating(false);
    draggingRef.current = true;
    containerRef.current?.setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (draggingRef.current) setFromClientX(e.clientX);
  };
  const endDrag = (e: React.PointerEvent) => {
    draggingRef.current = false;
    containerRef.current?.releasePointerCapture?.(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = pos;
    if (e.key === "ArrowLeft") next = pos - 3;
    else if (e.key === "ArrowRight") next = pos + 3;
    else if (e.key === "Home") next = 100;
    else if (e.key === "End") next = 0;
    else return;
    e.preventDefault();
    setAnimating(false);
    setPos(Math.max(0, Math.min(100, next)));
  };

  const transition = animating
    ? `clip-path 1.1s ${EASE}, left 1.1s ${EASE}`
    : "none";

  return (
    <div>
      <div
        ref={containerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="relative w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-2xl border border-line bg-surface"
        style={{ aspectRatio: `${gridCols} / ${gridRows}` }}
      >
        {/* AFTER — the mosaic, base layer */}
        {/* The test id marks the one canvas that is a plain 2D render of the
            generated mosaic: the 3D scene is WebGL (unreadable via getImageData)
            and the mockups composite the mosaic into a photo. */}
        <canvas
          ref={canvasRef}
          data-testid="mosaic-canvas"
          className="pointer-events-none absolute inset-0 h-full w-full"
        />

        {/* BEFORE — the original photo, clipped to the left of the divider */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeSrc}
          alt="Original photo"
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)`, transition }}
        />

        {/* Corner labels */}
        <span
          className="pointer-events-none absolute left-2 top-2 rounded-full bg-[rgba(27,25,22,.6)] backdrop-blur-sm px-3 py-1.5 text-[13px] font-medium text-white transition-opacity"
          style={{ opacity: pos > 8 ? 1 : 0 }}
        >
          Before
        </span>
        <span
          className="pointer-events-none absolute right-2 top-2 rounded-full bg-[rgba(27,25,22,.6)] backdrop-blur-sm px-3 py-1.5 text-[13px] font-medium text-white transition-opacity"
          style={{ opacity: pos < 92 ? 1 : 0 }}
        >
          After
        </span>

        {/* Divider + handle */}
        <div
          className="pointer-events-none absolute bottom-0 top-0"
          style={{ left: `${pos}%`, transform: "translateX(-50%)", transition }}
        >
          <div className="mx-auto h-full w-0.5 bg-white/90 shadow-[0_0_0_1px_rgba(0,0,0,0.25)]" />
          <div
            role="slider"
            aria-label="Compare original photo and LEGO mosaic"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(100 - pos)}
            tabIndex={0}
            onKeyDown={onKeyDown}
            className="pointer-events-auto absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-gray-700 shadow-md outline-none ring-accent focus-visible:ring-2"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 6 3 12l6 6" />
              <path d="m15 6 6 6-6 6" />
            </svg>
          </div>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-ink-2">
        Drag to compare your photo with the mosaic
      </p>
    </div>
  );
}
