"use client";

import { useState, useEffect } from "react";

interface Color {
  id?: string;
  name: string;
  hex: string;
  code: string | null;
}
interface Palette {
  id: string;
  name: string;
  enabled: boolean;
  colors: Color[];
}

export default function PalettesPage() {
  const [palettes, setPalettes] = useState<Palette[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Color[]>([]);
  const [newName, setNewName] = useState("");
  const [message, setMessage] = useState("");

  const load = () =>
    fetch("/api/palettes").then((r) => r.json()).then((d) => setPalettes(d.palettes ?? []));

  useEffect(() => {
    load();
  }, []);

  const flash = (m: string) => {
    setMessage(m);
    setTimeout(() => setMessage(""), 2500);
  };

  const enable = async (id: string) => {
    setPalettes((prev) => prev.map((p) => ({ ...p, enabled: p.id === id })));
    await fetch(`/api/palettes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: true }),
    });
    flash("Enabled palette");
  };

  const addPalette = async () => {
    if (!newName.trim()) return;
    const res = await fetch("/api/palettes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    if (res.ok) {
      setNewName("");
      load();
      flash("Added palette");
    } else flash("Error (name taken?)");
  };

  const removePalette = async (id: string) => {
    if (!confirm("Delete this palette and its colors?")) return;
    setPalettes((prev) => prev.filter((p) => p.id !== id));
    if (openId === id) setOpenId(null);
    await fetch(`/api/palettes/${id}`, { method: "DELETE" });
    flash("Deleted");
  };

  const openEditor = (p: Palette) => {
    setOpenId(p.id);
    setDraft(p.colors.map((c) => ({ name: c.name, hex: c.hex, code: c.code })));
  };

  const saveColors = async (id: string) => {
    const res = await fetch(`/api/palettes/${id}/colors`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colors: draft }),
    });
    if (res.ok) {
      load();
      flash("Saved colors");
    } else {
      const b = await res.json().catch(() => null);
      flash(b?.error ?? "Error saving colors");
    }
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Color Palettes</h1>
          <p className="text-muted text-sm mt-1">
            Exactly one palette is active — the generator builds artwork from it.
          </p>
        </div>
        {message && <span className="text-sm text-accent">{message}</span>}
      </div>

      <section className="bg-surface border border-border-custom rounded-xl p-6 mb-6 space-y-2">
        {palettes.map((p) => (
          <div key={p.id} className="bg-bg border border-border-custom rounded-lg">
            <div className="flex items-center gap-4 px-4 py-3">
              <span className="font-semibold flex-1">
                {p.name}{" "}
                <span className="text-xs text-muted font-normal">
                  ({p.colors.length} colors)
                </span>
              </span>
              {p.enabled ? (
                <span className="text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded">
                  Active
                </span>
              ) : (
                <button
                  onClick={() => enable(p.id)}
                  className="text-xs text-muted hover:text-accent font-medium"
                >
                  Set active
                </button>
              )}
              <button
                onClick={() => (openId === p.id ? setOpenId(null) : openEditor(p))}
                className="text-xs text-muted hover:text-text font-medium"
              >
                {openId === p.id ? "Close" : "Edit colors"}
              </button>
              <button
                onClick={() => removePalette(p.id)}
                className="text-xs text-muted hover:text-accent"
              >
                Delete
              </button>
            </div>

            {openId === p.id && (
              <div className="border-t border-border-custom p-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {draft.map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-surface border border-border-custom rounded-lg px-2 py-1.5"
                    >
                      <input
                        type="color"
                        value={c.hex}
                        onChange={(e) =>
                          setDraft((d) =>
                            d.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x))
                          )
                        }
                        className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                      />
                      <input
                        value={c.name}
                        placeholder="name"
                        onChange={(e) =>
                          setDraft((d) =>
                            d.map((x, j) => (j === i ? { ...x, name: e.target.value } : x))
                          )
                        }
                        className="w-24 px-1.5 py-1 rounded bg-bg border border-border-custom text-text text-xs focus:outline-none focus:border-accent"
                      />
                      <input
                        value={c.code ?? ""}
                        placeholder="code"
                        onChange={(e) =>
                          setDraft((d) =>
                            d.map((x, j) => (j === i ? { ...x, code: e.target.value } : x))
                          )
                        }
                        className="w-14 px-1.5 py-1 rounded bg-bg border border-border-custom text-muted text-xs focus:outline-none focus:border-accent"
                      />
                      <button
                        onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}
                        className="text-muted hover:text-accent text-xs px-1"
                        title="remove"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setDraft((d) => [...d, { name: "", hex: "#cccccc", code: null }])
                    }
                    className="text-sm text-accent hover:text-accent-hover font-medium"
                  >
                    + Add color
                  </button>
                  <button
                    onClick={() => saveColors(p.id)}
                    className="ml-auto bg-accent hover:bg-accent-hover text-white font-medium px-4 py-1.5 rounded-lg text-sm"
                  >
                    Save colors ({draft.length})
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="bg-surface border border-border-custom rounded-xl p-6">
        <h2 className="font-bold mb-4">Add a palette</h2>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-muted mb-1">Name</label>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={addPalette}
            className="bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            Add
          </button>
        </div>
      </section>
    </div>
  );
}
