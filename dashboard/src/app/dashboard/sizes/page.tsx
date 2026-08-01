"use client";

import { useState, useEffect } from "react";

interface Size {
  id: string;
  width: number;
  height: number;
  label: string | null;
  enabled: boolean;
  price: number;
  sortOrder: number;
}

export default function SizesPage() {
  const [sizes, setSizes] = useState<Size[]>([]);
  const [customSizeEnabled, setCustomSizeEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newW, setNewW] = useState(32);
  const [newH, setNewH] = useState(32);
  const [newLabel, setNewLabel] = useState("");

  const load = () =>
    Promise.all([
      fetch("/api/sizes").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ]).then(([sizesData, settings]) => {
      setSizes(sizesData.sizes ?? []);
      setCustomSizeEnabled(settings.customSizeEnabled ?? true);
      setDirty(false);
    });

  useEffect(() => {
    load();
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2500);
  };

  // Local edits only — nothing hits the API until "Save changes".
  const editSize = (id: string, data: Partial<Size>) => {
    setSizes((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    setDirty(true);
  };

  // Price saves immediately on blur (like the Pricing page) rather than
  // going through "Save changes" — so it can be validated and persisted on
  // its own without being tangled up with unrelated label/enabled edits.
  // Zero (or anything non-numeric) is rejected; the input reverts.
  const patchPrice = async (id: string, price: number) => {
    setSizes((prev) => prev.map((s) => (s.id === id ? { ...s, price } : s)));
    const res = await fetch(`/api/sizes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });
    flash(res.ok ? "Saved price" : "Error saving price");
  };

  const save = async () => {
    setSaving(true);
    const [sizesRes] = await Promise.all([
      fetch("/api/sizes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: sizes.map((s) => ({ id: s.id, enabled: s.enabled, label: s.label })),
        }),
      }).then((r) => r.json()),
      fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customSizeEnabled }),
      }),
    ]);
    if (sizesRes.sizes) setSizes(sizesRes.sizes);
    setDirty(false);
    setSaving(false);
    flash("Saved");
  };

  // Structural ops persist immediately; flush any staged edits first so they
  // aren't lost when we reload from the server.
  const add = async () => {
    if (dirty) await save();
    const res = await fetch("/api/sizes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ width: newW, height: newH, label: newLabel }),
    });
    if (res.ok) {
      setNewLabel("");
      await load();
      flash("Added");
    } else {
      flash("Error (maybe a duplicate size)");
    }
  };

  const remove = async (id: string) => {
    if (dirty) await save();
    await fetch(`/api/sizes/${id}`, { method: "DELETE" });
    await load();
    flash("Deleted");
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Mosaic Sizes</h1>
          <p className="text-muted text-sm mt-1">
            Sizes shown on the create page. Disabled sizes appear as “Coming soon”.
          </p>
        </div>
        {message && <span className="text-sm text-accent">{message}</span>}
      </div>

      {/* Feature flag: custom sizes on the frontend */}
      <section className="bg-surface border border-border-custom rounded-xl p-6 mb-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={customSizeEnabled}
            onChange={(e) => {
              setCustomSizeEnabled(e.target.checked);
              setDirty(true);
            }}
            className="mt-1"
          />
          <span>
            <span className="font-semibold block">Allow custom sizes</span>
            <span className="text-muted text-sm">
              When on, customers can type any width/height and freely drag-resize the
              preview. When off, the custom inputs are hidden and dragging snaps to the
              enabled sizes below.
            </span>
          </span>
        </label>
      </section>

      <section className="bg-surface border border-border-custom rounded-xl p-6 mb-6">
        <div className="space-y-2">
          {sizes.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 bg-bg border border-border-custom rounded-lg px-4 py-3"
            >
              <span className="font-semibold w-24">
                {s.width} × {s.height}
              </span>
              <input
                value={s.label ?? ""}
                placeholder="label (optional)"
                onChange={(e) => editSize(s.id, { label: e.target.value })}
                className="flex-1 px-3 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
              />
              <label className="flex items-center gap-2 text-sm text-muted shrink-0">
                Price (millimes)
                <input
                  type="number"
                  step="1"
                  min="1"
                  defaultValue={s.price}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (!Number.isFinite(value) || value <= 0) {
                      e.target.value = String(s.price);
                      flash("Price must be greater than 0");
                      return;
                    }
                    if (value !== s.price) patchPrice(s.id, value);
                  }}
                  className="w-24 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => editSize(s.id, { enabled: e.target.checked })}
                />
                Enabled
              </label>
              <button
                onClick={() => remove(s.id)}
                className="text-xs text-muted hover:text-accent"
              >
                Delete
              </button>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border-custom">
          {dirty && <span className="text-xs text-muted">Unsaved changes</span>}
          <button
            onClick={save}
            disabled={!dirty || saving}
            className="ml-auto bg-accent hover:bg-accent-hover disabled:bg-border-custom disabled:text-muted disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </section>

      <section className="bg-surface border border-border-custom rounded-xl p-6">
        <h2 className="font-bold mb-4">Add a size</h2>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-muted mb-1">Width</label>
            <input
              type="number"
              value={newW}
              onChange={(e) => setNewW(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Height</label>
            <input
              type="number"
              value={newH}
              onChange={(e) => setNewH(Number(e.target.value))}
              className="w-24 px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-muted mb-1">Label (optional)</label>
            <input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={add}
            className="bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
