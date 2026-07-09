"use client";

// A LEGO stud pitch is 8 mm, so a mosaic's real-world size is studs × 0.8 cm.
export const STUD_CM = 0.8;
export const MIN_STUDS = 16;
export const MAX_STUDS = 96;

export const clampStuds = (n: number, min = MIN_STUDS, max = MAX_STUDS) =>
  Math.max(min, Math.min(max, Math.round(n) || min));

const cm = (studs: number) => {
  const v = studs * STUD_CM;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
};

export const sizeCm = (w: number, h: number) =>
  w === h ? `${cm(w)} cm` : `${cm(w)}×${cm(h)} cm`;

/** A size option coming from the database. */
export interface SizeOption {
  width: number;
  height: number;
  label: string | null;
  enabled: boolean;
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
      <label className="block text-sm font-medium text-text mb-2">
        Mosaic size (studs)
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {sizes.map((p) => {
          const active = width === p.width && height === p.height;
          const base = "rounded-lg border px-2 py-2 text-center transition-colors";

          if (!p.enabled) {
            // Disabled → greyed, not selectable, "Coming soon" tooltip on hover.
            return (
              <div key={`${p.width}x${p.height}`} className="group relative">
                <button
                  type="button"
                  disabled
                  aria-disabled="true"
                  className={`${base} w-full cursor-not-allowed border-border-custom opacity-45`}
                >
                  <span className="block text-sm font-semibold">
                    {p.width} × {p.height}
                  </span>
                  <span className="block text-xs text-muted">
                    {sizeCm(p.width, p.height)}
                  </span>
                </button>
                <span
                  role="tooltip"
                  className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border-custom bg-surface px-2 py-1 text-xs text-text opacity-0 shadow-md transition-opacity group-hover:opacity-100"
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
              onClick={() => onChange(p.width, p.height)}
              className={`${base} ${
                active
                  ? "bg-accent text-white border-accent"
                  : "border-border-custom text-muted hover:border-accent/40 hover:text-text"
              }`}
            >
              <span className="block text-sm font-semibold">
                {p.width} × {p.height}
              </span>
              <span
                className={`block text-xs ${active ? "text-white/80" : "text-muted"}`}
              >
                {sizeCm(p.width, p.height)}
              </span>
            </button>
          );
        })}
      </div>

      {customSizeEnabled && (
        <div className="flex items-center gap-3">
          <div>
            <label className="text-xs text-muted">Width</label>
            <input
              type="number"
              min={minStud}
              max={maxStud}
              value={width}
              onChange={(e) => onChange(clampStuds(Number(e.target.value), minStud, maxStud), height)}
              className="block w-20 mt-0.5 px-2 py-1.5 bg-surface border border-border-custom rounded-lg text-sm text-text"
            />
          </div>
          <span className="mt-4 text-muted">x</span>
          <div>
            <label className="text-xs text-muted">Height</label>
            <input
              type="number"
              min={minStud}
              max={maxStud}
              value={height}
              onChange={(e) => onChange(width, clampStuds(Number(e.target.value), minStud, maxStud))}
              className="block w-20 mt-0.5 px-2 py-1.5 bg-surface border border-border-custom rounded-lg text-sm text-text"
            />
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        About {sizeCm(width, height)} of finished bricks — or drag the preview
        corners to {customSizeEnabled ? "resize" : "snap between sizes"}.
      </p>
    </div>
  );
}
