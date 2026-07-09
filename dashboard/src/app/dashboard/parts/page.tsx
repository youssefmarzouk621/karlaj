"use client";

import { useState, useEffect } from "react";

interface Part {
  id: string;
  name: string;
  partId: string;
  width: number;
  height: number;
  enabled: boolean;
  variable: number | null;
  weightGrams: number | null;
}

export default function PartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [message, setMessage] = useState("");

  const load = () =>
    fetch("/api/parts").then((r) => r.json()).then((d) => setParts(d.parts ?? []));

  useEffect(() => {
    load();
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2500);
  };

  const patch = async (id: string, data: Partial<Part>) => {
    setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
    await fetch(`/api/parts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    flash("Saved");
  };

  const is1x1 = (p: Part) => p.width === 1 && p.height === 1;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Brick Parts</h1>
          <p className="text-muted text-sm mt-1">
            Which plates the generator may use. The 1×1 “variable” caps the share of
            1×1 parts (e.g. 0.35 = max 35%); it’s ignored when 1×1 is the only enabled part.
          </p>
        </div>
        {message && <span className="text-sm text-accent">{message}</span>}
      </div>

      <section className="bg-surface border border-border-custom rounded-xl p-6">
        <div className="space-y-2">
          {parts.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 bg-bg border border-border-custom rounded-lg px-4 py-3"
            >
              <span className="font-semibold w-28">{p.name}</span>
              <span className="text-xs text-muted w-24">part {p.partId}</span>

              <label className="flex items-center gap-2 text-sm text-muted">
                g/piece
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={p.weightGrams ?? ""}
                  onBlur={(e) => patch(p.id, { weightGrams: e.target.value as unknown as number })}
                  className="w-20 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                />
              </label>

              {is1x1(p) && (
                <label className="flex items-center gap-2 text-sm text-muted">
                  1×1 cap
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    defaultValue={p.variable ?? ""}
                    onBlur={(e) => patch(p.id, { variable: e.target.value as unknown as number })}
                    className="w-20 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                  />
                </label>
              )}

              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer ml-auto">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  disabled={is1x1(p)}
                  title={is1x1(p) ? "1×1 must stay enabled to guarantee full coverage" : undefined}
                  onChange={(e) => patch(p.id, { enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted mt-4">
          Note: the 1×1 plate stays enabled — it’s needed to fill single leftover cells.
          “g/piece” is the weight of one piece; it lets Inventory convert between piece
          counts and purchased weight.
        </p>
      </section>
    </div>
  );
}
