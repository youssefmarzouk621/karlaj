"use client";

import { useState } from "react";

interface Props {
  /** The finished mosaic (the "after"). */
  after: string;
  /** The original photo (the "before"). */
  before: string;
  beforeAlt?: string;
  afterAlt?: string;
}

/** Homepage before/after reveal: photo clipped over the mosaic, driven by a range input. */
export default function CompareSlider({ after, before, beforeAlt = "Original photo", afterAlt = "Mosaic" }: Props) {
  const [pos, setPos] = useState(50);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square max-h-[640px] rounded-3xl overflow-hidden shadow-lg select-none">
        {/* eslint-disable @next/next/no-img-element */}
        <img src={after} alt={afterAlt} draggable={false} className="absolute inset-0 w-full h-full object-cover" />
        <img
          src={before}
          alt={beforeAlt}
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        />
        {/* eslint-enable @next/next/no-img-element */}
        <div
          className="absolute top-0 bottom-0 w-0.5 -ml-px bg-white shadow-[0_0_12px_rgba(0,0,0,.3)]"
          style={{ left: `${pos}%` }}
        >
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52px] h-[52px] rounded-full bg-white/80 backdrop-blur-[10px] shadow-md grid place-items-center text-[#1B1916]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18-6-6 6-6" />
              <path d="m15 6 6 6-6 6" />
            </svg>
          </span>
        </div>
        <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-[rgba(27,25,22,.6)] backdrop-blur-sm text-white text-[13px] font-semibold">
          Before
        </span>
        <span className="absolute top-4 right-4 px-3 py-1.5 rounded-full bg-[rgba(27,25,22,.6)] backdrop-blur-sm text-white text-[13px] font-semibold">
          After
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={pos}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Compare your photo with the mosaic"
          className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize m-0"
        />
      </div>
      <span className="text-[13px] text-ink-2">Drag to compare your photo with the mosaic</span>
    </div>
  );
}
