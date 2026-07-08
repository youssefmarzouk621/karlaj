"use client";

// A LEGO stud pitch is 8 mm, so a mosaic's real-world size is studs × 0.8 cm.
export const STUD_CM = 0.8;
export const MIN_STUDS = 16;
export const MAX_STUDS = 96;

export const clampStuds = (n: number) =>
  Math.max(MIN_STUDS, Math.min(MAX_STUDS, Math.round(n) || MIN_STUDS));

const cm = (studs: number) => {
  const v = studs * STUD_CM;
  return Number.isInteger(v) ? `${v}` : v.toFixed(1);
};

export const sizeCm = (w: number, h: number) =>
  w === h ? `${cm(w)} cm` : `${cm(w)}×${cm(h)} cm`;

const PRESETS = [
  { w: 16, h: 16 },
  { w: 32, h: 32 },
  { w: 48, h: 48 },
  { w: 64, h: 64 },
  { w: 48, h: 96 },
  { w: 96, h: 96 },
];

interface Props {
  width: number;
  height: number;
  onChange: (w: number, h: number) => void;
}

export default function SizeSelector({ width, height, onChange }: Props) {
  return (
    <div>
      <label className="block text-sm font-medium text-text mb-2">
        Mosaic size (studs)
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {PRESETS.map((p) => {
          const active = width === p.w && height === p.h;
          return (
            <button
              key={`${p.w}x${p.h}`}
              type="button"
              onClick={() => onChange(p.w, p.h)}
              className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                active
                  ? "bg-accent text-white border-accent"
                  : "border-border-custom text-muted hover:border-accent/40 hover:text-text"
              }`}
            >
              <span className="block text-sm font-semibold">
                {p.w} × {p.h}
              </span>
              <span
                className={`block text-xs ${active ? "text-white/80" : "text-muted"}`}
              >
                {sizeCm(p.w, p.h)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs text-muted">Width</label>
          <input
            type="number"
            min={MIN_STUDS}
            max={MAX_STUDS}
            value={width}
            onChange={(e) => onChange(clampStuds(Number(e.target.value)), height)}
            className="block w-20 mt-0.5 px-2 py-1.5 bg-surface border border-border-custom rounded-lg text-sm text-text"
          />
        </div>
        <span className="mt-4 text-muted">x</span>
        <div>
          <label className="text-xs text-muted">Height</label>
          <input
            type="number"
            min={MIN_STUDS}
            max={MAX_STUDS}
            value={height}
            onChange={(e) => onChange(width, clampStuds(Number(e.target.value)))}
            className="block w-20 mt-0.5 px-2 py-1.5 bg-surface border border-border-custom rounded-lg text-sm text-text"
          />
        </div>
      </div>

      <p className="mt-3 text-xs text-muted">
        About {sizeCm(width, height)} of finished bricks — or drag the preview
        corners to resize.
      </p>
    </div>
  );
}
