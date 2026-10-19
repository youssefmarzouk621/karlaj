"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import FramedPrint from "@/components/FramedPrint";
import FrameMockups, { hasFrameMockups } from "@/components/FrameMockups";
import RoomMockups from "@/components/RoomMockups";
import type { DrawPlacement } from "@/lib/drawMosaic";

// WebGL can't render on the server, so load the 3D view client-only.
const Mosaic3D = dynamic(() => import("@/components/Mosaic3D"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 grid place-items-center bg-[#151413] text-sm text-[#A9A399]">
      Loading 3D preview…
    </div>
  ),
});

type Tab = "print" | "3d" | "space" | "compare";
const TABS: { id: Tab; label: string }[] = [
  { id: "print", label: "Framed print" },
  { id: "3d", label: "3D view" },
  { id: "space", label: "In your space" },
  { id: "compare", label: "Before / after" },
];

interface Props {
  jobId: string;
  photo: string | null;
  /** CSS object-position of the photo crop the mosaic was built from. */
  photoPosition?: string;
  gridRows: number;
  gridCols: number;
  placements: DrawPlacement[];
  colorMap: Record<number, [number, number, number]>;
}

/** One big stage with tabs for the ways to look at the finished mosaic. */
export default function ResultViewer({
  jobId,
  photo,
  photoPosition,
  gridRows,
  gridCols,
  placements,
  colorMap,
}: Props) {
  const [tab, setTab] = useState<Tab>("print");
  const mosaic = { gridRows, gridCols, placements, colorMap };

  return (
    <div className="relative h-[620px] md:h-[760px] rounded-[32px] overflow-hidden bg-surface-2">
      <div
        role="tablist"
        aria-label="Preview"
        className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex gap-1 p-1 max-w-[calc(100%-24px)] overflow-x-auto rounded-full bg-glass backdrop-blur-[16px] border border-line shadow-md"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "print" && <FramedPrint {...mosaic} />}

      {tab === "3d" && (
        <Mosaic3D
          key={jobId}
          {...mosaic}
          className="absolute inset-0 h-full bg-[radial-gradient(circle_at_55%_40%,#2A2826,#11100F_75%)]"
        />
      )}

      {tab === "space" && (
        <div className="absolute inset-0 overflow-y-auto px-6 pt-24 pb-8">
          {hasFrameMockups(gridCols, gridRows) ? <FrameMockups {...mosaic} /> : <RoomMockups {...mosaic} />}
        </div>
      )}

      {tab === "compare" && (
        <div className="absolute inset-0 grid place-items-center px-6 pt-20 pb-6">
          <div className="w-full" style={{ maxWidth: `min(600px, ${(520 * gridCols) / Math.max(gridRows, 1)}px)` }}>
            <BeforeAfterSlider key={jobId} beforeSrc={photo ?? ""} beforePosition={photoPosition} {...mosaic} />
          </div>
        </div>
      )}
    </div>
  );
}
