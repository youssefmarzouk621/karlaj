"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawMosaic, type DrawPlacement } from "@/lib/drawMosaic";
import type { Part } from "@/lib/mosaicTypes";

interface Bag {
  bag_number: number;
  total_parts: number;
  section: { row_start: number; row_end: number; col_start: number; col_end: number };
}

interface Props {
  jobId: string;
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
  partsList: Part[];
  totalParts: number;
  bags: Bag[];
}

const COLLAPSED_ROWS = 8;
const eyebrow = "text-xs tracking-[.14em] uppercase font-semibold text-accent-ink";

/** Parts list (by color) and the bag layout, under the result viewer. */
export default function PartsBreakdown({
  jobId,
  gridRows,
  gridCols,
  placements,
  colorMap,
  partsList,
  totalParts,
  bags,
}: Props) {
  const [showAll, setShowAll] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // One row per color: the same color can appear on several plate sizes.
  const colors = useMemo(() => {
    const byColor = new Map<number, { name: string; rgb: [number, number, number]; n: number }>();
    for (const p of partsList) {
      const row = byColor.get(p.color_id) ?? { name: p.color_name, rgb: p.rgb, n: 0 };
      row.n += p.quantity;
      byColor.set(p.color_id, row);
    }
    return [...byColor.values()].sort((a, b) => b.n - a.n);
  }, [partsList]);
  const max = colors[0]?.n ?? 1;
  const visible = showAll ? colors : colors.slice(0, COLLAPSED_ROWS);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) drawMosaic(canvas, { gridRows, gridCols, placements, colorMap, width: 600 });
  }, [gridRows, gridCols, placements, colorMap]);

  return (
    <div className="grid lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] gap-6 items-start">
      <div className="rounded-[32px] bg-surface border border-line p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className={eyebrow}>Parts list</span>
            <h3 className="font-display font-normal text-4xl md:text-[40px] tracking-[-0.02em] leading-none">
              What&apos;s in the box
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {[`${totalParts.toLocaleString("en-US")} parts`, `${colors.length} colors`, `${bags.length} bags`].map((c) => (
              <span key={c} className="px-3 py-2 rounded-full bg-surface-2 text-[13px] font-semibold">
                {c}
              </span>
            ))}
          </div>
        </div>

        <div role="table" aria-label="Parts by color" className="flex flex-col">
          <div
            role="row"
            className="grid grid-cols-[24px_minmax(0,1.6fr)_minmax(0,1fr)_52px] sm:grid-cols-[28px_minmax(0,1.2fr)_minmax(0,2fr)_72px] gap-3 sm:gap-4 pb-2.5 text-xs text-ink-2 border-b border-line"
          >
            <span />
            <span>Color</span>
            <span>Share</span>
            <span className="text-right">Count</span>
          </div>
          {visible.map((c) => (
            <div
              key={c.name}
              role="row"
              data-testid="parts-row"
              className="grid grid-cols-[24px_minmax(0,1.6fr)_minmax(0,1fr)_52px] sm:grid-cols-[28px_minmax(0,1.2fr)_minmax(0,2fr)_72px] gap-3 sm:gap-4 items-center py-3 border-b border-line text-[15px]"
            >
              <span
                className="w-6 h-6 rounded-md shadow-[inset_0_0_0_1px_rgba(0,0,0,.12),inset_0_-3px_0_rgba(0,0,0,.15)]"
                style={{ backgroundColor: `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})` }}
              />
              <span className="font-medium truncate">{c.name}</span>
              <span className="h-1.5 rounded-md bg-surface-2 overflow-hidden">
                <span
                  className="block h-full rounded-md bg-ink opacity-80"
                  style={{ width: `${Math.max(2, Math.sqrt(c.n / max) * 100)}%` }}
                />
              </span>
              <span className="text-right tabular-nums font-semibold">{c.n.toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>

        {colors.length > COLLAPSED_ROWS && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="self-start h-11 px-[18px] rounded-full border border-line-strong bg-surface text-sm font-medium inline-flex items-center gap-2 hover:bg-surface-2 transition-colors"
          >
            {showAll ? "Show fewer" : `Show all ${colors.length} colors`}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={showAll ? "rotate-180" : ""}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        )}
      </div>

      <div className="rounded-[32px] bg-surface border border-line p-6 md:p-8 flex flex-col gap-5">
        <span className={eyebrow}>Instructions</span>
        <div
          className="relative rounded-2xl overflow-hidden"
          style={{ aspectRatio: `${gridCols} / ${gridRows}` }}
        >
          <canvas ref={canvasRef} className="block w-full h-full [filter:saturate(.6)_brightness(.9)]" />
          {bags.map((b) => (
            <span
              key={b.bag_number}
              className={`absolute grid place-items-center text-white font-semibold text-sm border border-white/35 ${
                b.bag_number === 1 ? "bg-[rgba(194,64,30,.55)]" : ""
              }`}
              style={{
                left: `${(b.section.col_start / gridCols) * 100}%`,
                top: `${(b.section.row_start / gridRows) * 100}%`,
                width: `${((b.section.col_end - b.section.col_start) / gridCols) * 100}%`,
                height: `${((b.section.row_end - b.section.row_start) / gridRows) * 100}%`,
              }}
            >
              {b.bag_number}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-lg font-semibold">Bag-by-bag booklet</span>
          <span className="text-sm leading-normal text-ink-2">
            {bags.length} numbered {bags.length === 1 ? "bag" : "bags"}. Build from bag 1 in the top-left.
          </span>
        </div>
        <a
          href={`/api/pdf/${jobId}`}
          download
          className="h-[52px] px-5 rounded-full border border-line-strong bg-surface text-[15px] font-medium flex items-center justify-between hover:bg-surface-2 transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
            </svg>
            instructions.pdf
          </span>
          <span className="text-[13px] text-ink-2">Download</span>
        </a>
      </div>
    </div>
  );
}
