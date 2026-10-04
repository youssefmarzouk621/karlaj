"use client";

import { useEffect, useState } from "react";

interface Props {
  /** The customer's photo (object URL). */
  photo: string | null;
  width: number;
  height: number;
  onCancel: () => void;
}

const GRID = 16;

// The server doesn't report progress, so these are an honest description of what
// happens, advanced on a timer — not a measurement.
const STEPS = [
  (w: number, h: number) => `Cropped to ${w} × ${h}`,
  () => "Matching real LEGO colors",
  () => "Placing bricks",
  () => "Writing bag-by-bag instructions",
];
const STEP_AT_MS = [0, 1200, 3500, 7000];

/** Bricks dropping into place, built from the customer's own photo. */
export default function GeneratingView({ photo, width, height, onCancel }: Props) {
  const [tile, setTile] = useState<string | null>(null);
  const [active, setActive] = useState(1);

  // Center-crop the photo to a small square so the tiles can slice it evenly.
  useEffect(() => {
    if (!photo) return;
    const img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      canvas
        .getContext("2d")
        ?.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, 256, 256);
      setTile(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.src = photo;
  }, [photo]);

  useEffect(() => {
    const timers = STEP_AT_MS.map((ms, i) => setTimeout(() => setActive(i), ms)).slice(1);
    return () => timers.forEach(clearTimeout);
  }, []);

  const tiles = [];
  for (let j = 0; j < GRID; j++) {
    for (let i = 0; i < GRID; i++) {
      const delay = ((GRID - 1 - j) * GRID + (j % 2 ? GRID - 1 - i : i)) * 9;
      tiles.push(
        <div
          key={j * GRID + i}
          className="rounded-[3px] bg-surface-2"
          style={{
            backgroundImage: tile ? `url(${tile})` : undefined,
            backgroundSize: `${GRID * 100}% ${GRID * 100}%`,
            backgroundPosition: `${(i / (GRID - 1)) * 100}% ${(j / (GRID - 1)) * 100}%`,
            animation: `brick-drop 4.2s cubic-bezier(.2,.7,.2,1) ${delay}ms infinite both`,
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,.18)",
          }}
        />
      );
    }
  }

  return (
    <section className="grid md:grid-cols-2 gap-10 md:gap-20 items-center py-8 md:py-16">
      <div className="justify-self-center md:justify-self-end bg-[#1B1916] p-3 shadow-art">
        <div className="bg-[#FBFAF8] p-5 md:p-7">
          <div
            className="w-[min(384px,70vw)] aspect-square grid gap-0.5"
            style={{ gridTemplateColumns: `repeat(${GRID}, 1fr)` }}
          >
            {tiles}
          </div>
        </div>
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-6 max-w-[420px]">
        <h1 className="font-display font-normal text-5xl md:text-6xl leading-none tracking-[-0.025em]">
          Building your mosaic…
        </h1>
        <p className="text-[17px] leading-relaxed text-ink-2">
          Matching your photo to real LEGO colors and placing every brick. This takes a few seconds.
        </p>
        <div className="relative h-1.5 rounded-md bg-surface-2 overflow-hidden">
          <span
            className="absolute inset-y-0 w-2/5 rounded bg-accent"
            style={{ animation: "pulse-bar 1.6s ease-in-out infinite" }}
          />
        </div>
        <ul className="flex flex-col gap-3 text-[15px]">
          {STEPS.map((label, i) => {
            const done = i < active;
            const current = i === active;
            return (
              <li key={i} className={`flex items-center gap-3 ${current ? "font-semibold" : ""} ${i > active ? "text-ink-2" : ""}`}>
                {done ? (
                  <span className="w-[22px] h-[22px] rounded-full bg-accent text-on-accent grid place-items-center">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                ) : current ? (
                  <span className="w-[22px] h-[22px] rounded-full grid place-items-center shadow-[inset_0_0_0_2px_var(--accent)]">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                  </span>
                ) : (
                  <span className="w-[22px] h-[22px] rounded-full shadow-[inset_0_0_0_1.5px_var(--line-strong)]" />
                )}
                {label(width, height)}
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onCancel}
          className="self-start -ml-[18px] h-11 px-[18px] rounded-full text-sm font-medium text-ink-2 hover:bg-surface-2 hover:text-ink transition-colors"
        >
          Cancel
        </button>
      </div>
    </section>
  );
}
