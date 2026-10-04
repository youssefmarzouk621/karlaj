"use client";

import { useEffect, useState } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";
import { STUD_CM, sizeCm } from "@/components/SizeSelector";

interface Props {
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

// Every scene is drawn to real-world scale: 2 SVG px = 1 cm. So the framed
// mosaic's size relative to the furniture reflects the actual chosen size.
const PX_PER_CM = 2;
const VB_W = 640;
const VB_H = 480;
const FLOOR_Y = 360;

export type Variant = "living" | "entry" | "gallery";

const SCENES: { variant: Variant; label: string }[] = [
  { variant: "living", label: "Living room" },
  { variant: "entry", label: "Entryway" },
  { variant: "gallery", label: "Gallery wall" },
];

function FramedArt({
  cx,
  cy,
  w,
  h,
  src,
}: {
  cx: number;
  cy: number;
  w: number;
  h: number;
  src: string | null;
}) {
  const b = Math.max(3, Math.min(9, w * 0.05)); // frame border, scaled to art
  const ix = cx - w / 2 + b;
  const iy = cy - h / 2 + b;
  const iw = w - 2 * b;
  const ih = h - 2 * b;
  return (
    <g>
      <rect
        x={cx - w / 2 + 3}
        y={cy - h / 2 + 5}
        width={w}
        height={h}
        rx={2}
        fill="rgba(0,0,0,0.18)"
      />
      <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={2} fill="#23262d" />
      {src && (
        <image
          href={src}
          x={ix}
          y={iy}
          width={iw}
          height={ih}
          preserveAspectRatio="none"
        />
      )}
      <rect
        x={ix}
        y={iy}
        width={iw}
        height={ih}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={0.75}
      />
    </g>
  );
}

function Scene({
  variant,
  frameW,
  frameH,
  src,
}: {
  variant: Variant;
  frameW: number;
  frameH: number;
  src: string | null;
}) {
  if (variant === "living") {
    return (
      <>
        <rect x={0} y={0} width={VB_W} height={FLOOR_Y} fill="#ece7dd" />
        <rect x={0} y={FLOOR_Y} width={VB_W} height={VB_H - FLOOR_Y} fill="#d9cebc" />
        <rect x={0} y={FLOOR_Y - 6} width={VB_W} height={6} fill="#c8bca8" />
        <FramedArt cx={320} cy={140} w={frameW} h={frameH} src={src} />
        {/* sofa */}
        <rect x={120} y={250} width={400} height={92} rx={16} fill="#9fb1b6" />
        <rect x={132} y={214} width={376} height={52} rx={14} fill="#b0c0c4" />
        <rect x={150} y={244} width={166} height={40} rx={10} fill="#c2ced1" />
        <rect x={324} y={244} width={166} height={40} rx={10} fill="#c2ced1" />
        <rect x={140} y={338} width={14} height={16} fill="#6f7d80" />
        <rect x={486} y={338} width={14} height={16} fill="#6f7d80" />
        {/* plant */}
        <rect x={556} y={300} width={40} height={54} rx={4} fill="#b9805a" />
        <circle cx={576} cy={288} r={26} fill="#5f8f5a" />
        <circle cx={558} cy={300} r={18} fill="#6b9b62" />
        <circle cx={594} cy={300} r={18} fill="#6b9b62" />
      </>
    );
  }

  if (variant === "entry") {
    const tableTop = 300;
    return (
      <>
        <rect x={0} y={0} width={VB_W} height={FLOOR_Y} fill="#e6e8ee" />
        <rect x={0} y={FLOOR_Y} width={VB_W} height={VB_H - FLOOR_Y} fill="#cfd3dc" />
        <rect x={0} y={FLOOR_Y - 6} width={VB_W} height={6} fill="#bfc4cf" />
        {/* framed art resting on the console */}
        <FramedArt cx={320} cy={tableTop - frameH / 2} w={frameW} h={frameH} src={src} />
        {/* console table */}
        <rect x={200} y={tableTop} width={240} height={14} rx={3} fill="#8a6f57" />
        <rect x={210} y={tableTop + 14} width={10} height={FLOOR_Y - tableTop - 14} fill="#7a6049" />
        <rect x={420} y={tableTop + 14} width={10} height={FLOOR_Y - tableTop - 14} fill="#7a6049" />
        {/* vase + books */}
        <ellipse cx={236} cy={tableTop - 4} rx={11} ry={16} fill="#c47b66" />
        <rect x={392} y={tableTop - 12} width={30} height={12} fill="#6b7a99" />
        <rect x={396} y={tableTop - 22} width={26} height={10} fill="#8b9ab5" />
      </>
    );
  }

  // gallery
  return (
    <>
      <rect x={0} y={0} width={VB_W} height={FLOOR_Y} fill="#eae5df" />
      <rect x={230} y={0} width={180} height={FLOOR_Y} fill="#e0d8cd" />
      <rect x={0} y={FLOOR_Y} width={VB_W} height={VB_H - FLOOR_Y} fill="#d3c8b7" />
      <rect x={0} y={FLOOR_Y - 6} width={VB_W} height={6} fill="#c3b7a2" />
      {/* picture light + warm glow */}
      <rect x={296} y={145 - frameH / 2 - 20} width={48} height={7} rx={3} fill="#3b3b3b" />
      <ellipse
        cx={320}
        cy={145 - frameH / 2 + 6}
        rx={frameW * 0.7}
        ry={16}
        fill="rgba(255,224,150,0.35)"
      />
      <FramedArt cx={320} cy={145} w={frameW} h={frameH} src={src} />
      {/* bench */}
      <rect x={230} y={318} width={180} height={14} rx={3} fill="#9a9186" />
      <rect x={244} y={332} width={10} height={FLOOR_Y - 332} fill="#82796d" />
      <rect x={386} y={332} width={10} height={FLOOR_Y - 332} fill="#82796d" />
    </>
  );
}

/** One scale-accurate room scene with `src` framed on the wall, as an SVG. */
export function RoomScene({
  variant,
  label,
  gridRows,
  gridCols,
  src,
}: {
  variant: Variant;
  label: string;
  gridRows: number;
  gridCols: number;
  src: string | null;
}) {
  const frameW = gridCols * STUD_CM * PX_PER_CM;
  const frameH = gridRows * STUD_CM * PX_PER_CM;
  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      className="block h-full w-full"
      role="img"
      aria-label={`Your mosaic shown in a ${label.toLowerCase()} setting`}
    >
      <Scene variant={variant} frameW={frameW} frameH={frameH} src={src} />
    </svg>
  );
}

/**
 * Shows the finished mosaic composited into three scale-accurate room scenes,
 * so the buyer can picture the piece on their wall at its real size.
 */
export default function RoomMockups({
  gridRows,
  gridCols,
  placements,
  colorMap,
}: Props) {
  const [src, setSrc] = useState<string | null>(null);

  // Render the mosaic once to a data URL, reused across all three scenes.
  // Deferred a frame so the scene skeleton paints before we rasterize (and so
  // the setState isn't synchronous inside the effect body).
  useEffect(() => {
    if (placements.length === 0) return;
    const raf = requestAnimationFrame(() => {
      const canvas = document.createElement("canvas");
      drawMosaic(canvas, { gridRows, gridCols, placements, colorMap, width: 440 });
      setSrc(canvas.toDataURL("image/png"));
    });
    return () => cancelAnimationFrame(raf);
  }, [gridRows, gridCols, placements, colorMap]);

  const label = sizeCm(gridCols, gridRows);

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {SCENES.map((s) => (
        <figure key={s.variant} className="m-0">
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <RoomScene variant={s.variant} label={s.label} gridRows={gridRows} gridCols={gridCols} src={src} />
          </div>
          <figcaption className="mt-1.5 text-center text-xs text-ink-2">
            {s.label} · {label}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
