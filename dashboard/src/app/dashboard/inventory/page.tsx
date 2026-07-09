"use client";

import { useState, useEffect, useCallback } from "react";

interface Part {
  id: string;
  name: string;
  partId: string;
  weightGrams: number | null;
}
interface Palette {
  id: string;
  name: string;
  enabled: boolean;
}
interface Row {
  colorId: string;
  name: string;
  hex: string;
  code: string | null;
  quantity: number;
  grams: number;
}

export default function InventoryPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [partId, setPartId] = useState("");
  const [paletteId, setPaletteId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState("");

  const part = parts.find((p) => p.id === partId);
  const weight = part?.weightGrams ?? null; // grams per piece (null = no conversion)

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(""), 2500);
  };

  // Load the selectors once. Default the part + palette to the first part and the
  // enabled palette so the page shows stock immediately.
  useEffect(() => {
    Promise.all([
      fetch("/api/parts").then((r) => r.json()),
      fetch("/api/palettes").then((r) => r.json()),
    ]).then(([partsData, palettesData]) => {
      const ps: Part[] = partsData.parts ?? [];
      const pals: Palette[] = palettesData.palettes ?? [];
      setParts(ps);
      setPalettes(pals);
      if (ps.length) setPartId((cur) => cur || ps[0].id);
      if (pals.length) {
        const active = pals.find((p) => p.enabled) ?? pals[0];
        setPaletteId((cur) => cur || active.id);
      }
    });
  }, []);

  const loadRows = useCallback(() => {
    if (!partId || !paletteId) return;
    fetch(`/api/inventory?partId=${partId}&paletteId=${paletteId}`)
      .then((r) => r.json())
      .then((d) => setRows(d.rows ?? []));
  }, [partId, paletteId]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  const save = async (colorId: string, quantity: number, grams: number) => {
    setRows((prev) =>
      prev.map((r) => (r.colorId === colorId ? { ...r, quantity, grams } : r))
    );
    await fetch("/api/inventory", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partId, colorId, quantity, grams }),
    });
    flash("Saved");
  };

  // Editing one field derives the other from the part's g/piece weight (when set).
  const onPieces = (r: Row, value: string) => {
    const quantity = Math.max(0, Math.round(Number(value) || 0));
    const grams = weight != null ? +(quantity * weight).toFixed(1) : r.grams;
    save(r.colorId, quantity, grams);
  };
  const onKg = (r: Row, value: string) => {
    const grams = Math.max(0, (Number(value) || 0) * 1000);
    const quantity = weight != null && weight > 0 ? Math.round(grams / weight) : r.quantity;
    save(r.colorId, quantity, grams);
  };

  const totalPieces = rows.reduce((s, r) => s + r.quantity, 0);
  const totalKg = rows.reduce((s, r) => s + r.grams, 0) / 1000;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Inventory</h1>
          <p className="text-muted text-sm mt-1">
            On-hand stock per color for a brick part. Enter pieces or weight — the other
            is derived from the part’s g/piece. Used later to build artwork from what you own.
          </p>
        </div>
        {message && <span className="text-sm text-accent">{message}</span>}
      </div>

      <section className="bg-surface border border-border-custom rounded-xl p-6 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Part</label>
            <select
              value={partId}
              onChange={(e) => setPartId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            >
              {parts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (part {p.partId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Palette</label>
            <select
              value={paletteId}
              onChange={(e) => setPaletteId(e.target.value)}
              className="px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            >
              {palettes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.enabled ? " (active)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="ml-auto text-right text-xs text-muted">
            <div>
              {weight != null ? `${weight} g / piece` : "no g/piece set"}
            </div>
            <div className="text-text font-semibold">
              Σ {totalPieces.toLocaleString()} pcs · {totalKg.toFixed(2)} kg
            </div>
          </div>
        </div>
        {weight == null && (
          <p className="text-xs text-accent mt-3">
            This part has no “g/piece” weight — set it on the Parts page to auto-convert
            between pieces and kg. Until then, edit pieces and weight independently.
          </p>
        )}
      </section>

      <section className="bg-surface border border-border-custom rounded-xl p-6">
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.colorId}
              className="flex items-center gap-4 bg-bg border border-border-custom rounded-lg px-4 py-3"
            >
              <span
                className="w-6 h-6 rounded border border-border-custom shrink-0"
                style={{ backgroundColor: r.hex }}
              />
              <span className="font-semibold flex-1">
                {r.name}
                {r.code && <span className="text-xs text-muted font-normal ml-2">{r.code}</span>}
              </span>

              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={r.quantity}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) =>
                        x.colorId === r.colorId
                          ? { ...x, quantity: Number(e.target.value) || 0 }
                          : x
                      )
                    )
                  }
                  onBlur={(e) => onPieces(r, e.target.value)}
                  className="w-24 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm text-right focus:outline-none focus:border-accent"
                />
                pcs
              </label>

              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={+(r.grams / 1000).toFixed(3)}
                  onChange={(e) =>
                    setRows((prev) =>
                      prev.map((x) =>
                        x.colorId === r.colorId
                          ? { ...x, grams: (Number(e.target.value) || 0) * 1000 }
                          : x
                      )
                    )
                  }
                  onBlur={(e) => onKg(r, e.target.value)}
                  className="w-24 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm text-right focus:outline-none focus:border-accent"
                />
                kg
              </label>
            </div>
          ))}
          {rows.length === 0 && (
            <p className="text-sm text-muted">Pick a part and palette to record stock.</p>
          )}
        </div>
      </section>
    </div>
  );
}
