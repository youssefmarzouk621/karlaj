"use client";

import dynamic from "next/dynamic";

const LegoScene = dynamic(() => import("@/components/LegoScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full grid place-items-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

/** The hero's live three.js build, framed as a dark gallery panel. */
export default function HeroScene() {
  return (
    <div className="relative h-[420px] md:h-[680px] rounded-[32px] overflow-hidden bg-[#151413] border border-line">
      <div className="absolute inset-0">
        <LegoScene />
      </div>
      <span className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-3.5 py-2 rounded-full bg-white/10 backdrop-blur-[10px] border border-white/10 text-[13px] text-[#F2EEE7]">
        Drag to rotate
      </span>
    </div>
  );
}
