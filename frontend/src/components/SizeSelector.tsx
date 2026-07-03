"use client";

const PRESETS = [
  { label: "16 x 16", w: 16, h: 16 },
  { label: "32 x 32", w: 32, h: 32 },
  { label: "48 x 48", w: 48, h: 48 },
  { label: "64 x 64", w: 64, h: 64 },
  { label: "48 x 96", w: 48, h: 96 },
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
      <div className="flex flex-wrap gap-2 mb-3">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.w, p.h)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              width === p.w && height === p.h
                ? "bg-accent text-white border-accent"
                : "border-border-custom text-muted hover:border-accent/40 hover:text-text"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label className="text-xs text-muted">Width</label>
          <input
            type="number"
            min={16}
            max={96}
            value={width}
            onChange={(e) => onChange(Number(e.target.value), height)}
            className="block w-20 mt-0.5 px-2 py-1.5 bg-surface border border-border-custom rounded-lg text-sm text-text"
          />
        </div>
        <span className="mt-4 text-muted">x</span>
        <div>
          <label className="text-xs text-muted">Height</label>
          <input
            type="number"
            min={16}
            max={96}
            value={height}
            onChange={(e) => onChange(width, Number(e.target.value))}
            className="block w-20 mt-0.5 px-2 py-1.5 bg-surface border border-border-custom rounded-lg text-sm text-text"
          />
        </div>
      </div>
    </div>
  );
}
