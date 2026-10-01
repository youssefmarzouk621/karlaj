"use client";

import { useState, useEffect } from "react";
import { validateParts, type PartKind } from "@/lib/parts";

interface Part {
  id: string;
  name: string;
  partId: string;
  kind: PartKind;
  width: number;
  height: number;
  enabled: boolean;
  variable: number | null;
  weightGrams: number | null;
  compatibleBaseIds: string[];
}

// Local edit state. Number fields are kept as the raw input text so partial
// input ("0.", "") can be typed; they're parsed for validation and saving.
interface Draft {
  enabled: boolean;
  variable: string;
  weightGrams: string;
}

const toDraft = (p: Part): Draft => ({
  enabled: p.enabled,
  variable: p.variable === null ? "" : String(p.variable),
  weightGrams: p.weightGrams === null ? "" : String(p.weightGrams),
});

const parse = (s: string) => (s.trim() === "" ? null : Number(s));

export default function PartsPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const reset = (list: Part[]) => {
    setParts(list);
    setDrafts(Object.fromEntries(list.map((p) => [p.id, toDraft(p)])));
  };

  // A failed request (e.g. a 500 with an empty body) shows an error instead of
  // crashing on `r.json()`.
  const load = () =>
    fetch("/api/parts")
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        reset(d.parts ?? []);
      })
      .catch((e: Error) => flash(`Couldn't load parts: ${e.message}`));

  useEffect(() => {
    load();
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2500);
  };

  // Local edits only — nothing hits the API until "Save changes".
  const edit = (id: string, data: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...data } }));

  const changed = parts.filter((p) => {
    const d = drafts[p.id];
    if (!d) return false;
    const o = toDraft(p);
    return (
      d.enabled !== o.enabled ||
      parse(d.variable) !== parse(o.variable) ||
      parse(d.weightGrams) !== parse(o.weightGrams)
    );
  });
  const dirty = changed.length > 0;

  const edited = parts.map((p) => {
    const d = drafts[p.id] ?? toDraft(p);
    return { ...p, enabled: d.enabled, variable: parse(d.variable), weightGrams: parse(d.weightGrams) };
  });
  const errors = dirty ? validateParts(edited) : [];

  const save = async () => {
    setSaving(true);
    const res = await fetch("/api/parts", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        updates: edited
          .filter((p) => changed.some((c) => c.id === p.id))
          .map((p) => ({
            id: p.id,
            enabled: p.enabled,
            variable: p.variable,
            weightGrams: p.weightGrams,
          })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok) {
      reset(data.parts ?? []);
      flash("Saved");
    } else {
      flash(data.error ?? "Error saving");
    }
  };

  const is1x1 = (p: Part) => p.kind === "BRICK" && p.width === 1 && p.height === 1;
  const inputClass =
    "w-20 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent";

  const bricks = parts.filter((p) => p.kind === "BRICK");
  const bases = parts.filter((p) => p.kind === "BASE");
  const baseName = new Map(bases.map((b) => [b.id, b.name]));

  const renderRow = (p: Part) => {
    const d = drafts[p.id] ?? toDraft(p);
    const fits =
      p.kind === "BRICK"
        ? p.compatibleBaseIds.map((id) => baseName.get(id)).filter(Boolean).join(", ") || "no base"
        : `${p.width}×${p.height} studs`;
    return (
      <div
        key={p.id}
        data-testid={`part-${p.partId}`}
        className="flex items-center gap-4 bg-bg border border-border-custom rounded-lg px-4 py-3"
      >
        <div className="w-44">
          <span className="font-semibold block">{p.name}</span>
          <span className="text-xs text-muted">
            part {p.partId} · {p.kind === "BRICK" ? `fits ${fits}` : fits}
          </span>
        </div>

        <label className="flex items-center gap-2 text-sm text-muted">
          g/piece
          <input
            type="number"
            step="0.01"
            min="0"
            value={d.weightGrams}
            onChange={(e) => edit(p.id, { weightGrams: e.target.value })}
            className={inputClass}
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
              value={d.variable}
              onChange={(e) => edit(p.id, { variable: e.target.value })}
              className={inputClass}
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-muted cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={d.enabled}
            onChange={(e) => edit(p.id, { enabled: e.target.checked })}
          />
          Enabled
        </label>
      </div>
    );
  };

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
        <h2 className="font-bold mb-1">Bricks</h2>
        <p className="text-xs text-muted mb-3">Tiled into the mosaic by the generator.</p>
        <div className="space-y-2">{bricks.map(renderRow)}</div>

        <h2 className="font-bold mt-6 mb-1">Bases</h2>
        <p className="text-xs text-muted mb-3">
          What the mosaic is built on. Never placed by the generator.
        </p>
        <div className="space-y-2">{bases.map(renderRow)}</div>

        {errors.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 text-sm text-red-500">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border-custom">
          {dirty && <span className="text-xs text-muted">Unsaved changes</span>}
          <button
            onClick={() => reset(parts)}
            disabled={!dirty || saving}
            className="ml-auto text-sm text-muted hover:text-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Discard
          </button>
          <button
            onClick={save}
            disabled={!dirty || saving || errors.length > 0}
            className="bg-accent hover:bg-accent-hover disabled:bg-border-custom disabled:text-muted disabled:cursor-not-allowed text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        <p className="text-xs text-muted mt-4">
          Exactly one 1×1 brick must be enabled — square (3024) or round (4073) — it fills
          single leftover cells. At least one base must be enabled, and every enabled base
          must fit every enabled brick. For a round-only mosaic, enable the round 1×1 and
          one of its bases, and disable every other brick. “g/piece” is the weight of one piece; it lets Inventory convert
          between piece counts and purchased weight.
        </p>
      </section>
    </div>
  );
}
