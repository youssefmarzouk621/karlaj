"use client";

import { STUD_CM, MIN_STUDS, MAX_STUDS, clampStuds, sizeCm } from "@/lib/studs";

// Re-exported so existing imports from this module keep working; the helpers
// live in lib/studs so server components can use them too.
export { STUD_CM, MIN_STUDS, MAX_STUDS, clampStuds, sizeCm };

/** A size option coming from the database. */
export interface SizeOption {
  width: number;
  height: number;
  label: string | null;
  enabled: boolean;
  /** Admin-entered customer-facing price, e.g. "140TND". Empty until set. */
  displayPrice: string;
}

interface Props {
  sizes: SizeOption[];
  width: number;
  height: number;
  minStud: number;
  maxStud: number;
  /** When false, hide the free width/height inputs — only the presets remain. */
  customSizeEnabled: boolean;
  onChange: (w: number, h: number) => void;
}

const numberInput =
  "block w-24 mt-1 h-11 px-3 bg-surface border border-line-strong rounded-xl text-sm text-ink focus:outline-none focus:border-accent";

export default function SizeSelector({
  sizes,
  width,
  height,
  minStud,
  maxStud,
  customSizeEnabled,
  onChange,
}: Props) {
  return (
    <div>
      <div id="size-label" className="text-sm font-semibold text-ink mb-3">
        Mosaic size (studs)
      </div>

      <div aria-labelledby="size-label" className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
        {sizes.map((p) => {
          const active = width === p.width && height === p.height;
          const base =
            "min-h-[84px] w-full rounded-[18px] px-4 py-3.5 text-left flex flex-col gap-1 transition-all duration-200";

          if (!p.enabled) {
            // Disabled → greyed, not selectable, "Coming soon" tooltip on hover.
            return (
              <div key={`${p.width}x${p.height}`} className="group relative">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className={`${base} cursor-not-allowed bg-surface shadow-[inset_0_0_0_1px_var(--line-strong)] opacity-45`}
                >
                  <span className="text-[17px] font-semibold">
                    {p.width} × {p.height}
                  </span>
                  <span className="text-[13px] opacity-75">{sizeCm(p.width, p.height)}</span>
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink opacity-0 shadow-md transition-opacity group-hover:opacity-100"
                >
                  Coming soon
                </span>
              </div>
            );
          }

          return (
            <button
              key={`${p.width}x${p.height}`}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(p.width, p.height)}
              className={`${base} hover:-translate-y-0.5 active:scale-[.98] ${
                active
                  ? "bg-ink text-bg shadow-[inset_0_0_0_1px_var(--ink)]"
                  : "bg-surface text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]"
              }`}
            >
              <span className="text-[17px] font-semibold">
                {p.width} × {p.height}
              </span>
              <span className="text-[13px] opacity-75">{sizeCm(p.width, p.height)}</span>
              {p.displayPrice && (
                <span className="text-[13px] font-semibold mt-0.5">{p.displayPrice}</span>
              )}
            </button>
          );
        })}
      </div>

      {customSizeEnabled && (
        <div className="flex items-end gap-3">
          <label className="text-xs text-ink-2">
            Width
            <input
              type="number"
              min={minStud}
              max={maxStud}
              value={width}
              onChange={(e) => onChange(clampStuds(Number(e.target.value), minStud, maxStud), height)}
              className={numberInput}
            />
          </label>
          <span className="pb-3 text-ink-2">×</span>
          <label className="text-xs text-ink-2">
            Height
            <input
              type="number"
              min={minStud}
              max={maxStud}
              value={height}
              onChange={(e) => onChange(width, clampStuds(Number(e.target.value), minStud, maxStud))}
              className={numberInput}
            />
          </label>
        </div>
      )}

      <p className="mt-4 text-[13px] text-ink-2">
        About {sizeCm(width, height)} of finished bricks — or drag the crop corners to{" "}
        {customSizeEnabled ? "resize" : "snap between sizes"}.
      </p>
    </div>
  );
}
