"use client";

import { useState, useEffect } from "react";

interface Plan {
  id?: string;
  name: string;
  price: string;
  period: string;
  description: string;
  featured: boolean;
  ctaText: string;
  ctaLink: string;
  sortOrder: number;
  features: { id?: string; text: string }[];
}

const EMPTY_PLAN: Plan = {
  name: "",
  price: "",
  period: "/mo",
  description: "",
  featured: false,
  ctaText: "Get started",
  ctaLink: "/create",
  sortOrder: 0,
  features: [],
};

interface SizePrice {
  id: string;
  width: number;
  height: number;
  label: string | null;
  price: number;
  displayPrice: string;
}

interface Charge {
  id: string;
  name: string;
  price: number;
  displayPrice: string;
  enabled: boolean;
}

const EMPTY_CHARGE = { name: "", price: 0, displayPrice: "" };

interface PaletteMultiplier {
  id: string;
  name: string;
  enabled: boolean;
  priceMultiplier: number;
}

export default function PricingPage() {
  // --- Order pricing: price per mosaic size -------------------------------
  const [sizes, setSizes] = useState<SizePrice[]>([]);
  const [sizesMessage, setSizesMessage] = useState("");

  const loadSizes = () =>
    fetch("/api/sizes")
      .then((r) => r.json())
      .then((d) => setSizes(d.sizes ?? []));

  useEffect(() => {
    loadSizes();
  }, []);

  const flashSizes = (msg: string) => {
    setSizesMessage(msg);
    setTimeout(() => setSizesMessage(""), 2500);
  };

  const patchSize = async (id: string, data: Partial<SizePrice>) => {
    setSizes((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    await fetch(`/api/sizes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    flashSizes("Saved");
  };

  // --- Order pricing: multiplier per color palette -------------------------
  const [palettes, setPalettes] = useState<PaletteMultiplier[]>([]);
  const [palettesMessage, setPalettesMessage] = useState("");

  const loadPalettes = () =>
    fetch("/api/palettes")
      .then((r) => r.json())
      .then((d) => setPalettes(d.palettes ?? []));

  useEffect(() => {
    loadPalettes();
  }, []);

  const flashPalettes = (msg: string) => {
    setPalettesMessage(msg);
    setTimeout(() => setPalettesMessage(""), 2500);
  };

  const patchPalette = async (id: string, priceMultiplier: number) => {
    setPalettes((prev) => prev.map((p) => (p.id === id ? { ...p, priceMultiplier } : p)));
    await fetch(`/api/palettes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceMultiplier }),
    });
    flashPalettes("Saved");
  };

  // --- Order pricing: extra charges (shipping, packaging, services, ...) --
  const [charges, setCharges] = useState<Charge[]>([]);
  const [chargesMessage, setChargesMessage] = useState("");
  const [newCharge, setNewCharge] = useState(EMPTY_CHARGE);

  const loadCharges = () =>
    fetch("/api/charges")
      .then((r) => r.json())
      .then((d) => setCharges(d.charges ?? []));

  useEffect(() => {
    loadCharges();
  }, []);

  const flashCharges = (msg: string) => {
    setChargesMessage(msg);
    setTimeout(() => setChargesMessage(""), 2500);
  };

  const patchCharge = async (id: string, data: Partial<Charge>) => {
    setCharges((prev) => prev.map((c) => (c.id === id ? { ...c, ...data } : c)));
    await fetch(`/api/charges/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    flashCharges("Saved");
  };

  const addCharge = async () => {
    if (!newCharge.name.trim()) return;
    const res = await fetch("/api/charges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCharge),
    });
    if (res.ok) {
      setNewCharge(EMPTY_CHARGE);
      await loadCharges();
      flashCharges("Added");
    }
  };

  const removeCharge = async (id: string) => {
    await fetch(`/api/charges/${id}`, { method: "DELETE" });
    await loadCharges();
    flashCharges("Deleted");
  };

  // --- Marketing pricing plans (landing page cards) -----------------------
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [featureInput, setFeatureInput] = useState("");
  const [message, setMessage] = useState("");

  const loadPlans = () => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then(setPlans);
  };

  useEffect(loadPlans, []);

  const savePlan = async () => {
    if (!editing) return;
    const method = editing.id ? "PUT" : "POST";
    const body = {
      ...editing,
      features: editing.features.map((f) => f.text),
    };

    const res = await fetch("/api/pricing", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      setEditing(null);
      loadPlans();
      setMessage("Plan saved");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const deletePlan = async (id: string) => {
    await fetch(`/api/pricing?id=${id}`, { method: "DELETE" });
    loadPlans();
  };

  const addFeatureToPlan = () => {
    if (!editing || !featureInput.trim()) return;
    setEditing({
      ...editing,
      features: [...editing.features, { text: featureInput.trim() }],
    });
    setFeatureInput("");
  };

  const removeFeatureFromPlan = (idx: number) => {
    if (!editing) return;
    setEditing({
      ...editing,
      features: editing.features.filter((_, i) => i !== idx),
    });
  };

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-black tracking-tight">Pricing</h1>
        <p className="text-muted text-sm mt-1">
          Configure what customers are charged, and the marketing pricing plans shown on
          the landing page.
        </p>
      </div>

      {/* Size pricing */}
      <section className="bg-surface border border-border-custom rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold">Size pricing</h2>
            <p className="text-muted text-xs mt-1">
              What a customer pays for each mosaic size. Price is in millimes (1 TND =
              1000 millimes); display price is what customers see (e.g. &quot;140TND&quot;).
            </p>
          </div>
          {sizesMessage && <span className="text-sm text-accent shrink-0">{sizesMessage}</span>}
        </div>
        <div className="space-y-2">
          {sizes.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-4 bg-bg border border-border-custom rounded-lg px-4 py-3"
            >
              <span className="font-semibold w-24 shrink-0">
                {s.width} × {s.height}
              </span>
              <label className="flex items-center gap-2 text-sm text-muted">
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
                      flashSizes("Price must be greater than 0");
                      return;
                    }
                    if (value !== s.price) patchSize(s.id, { price: value });
                  }}
                  className="w-28 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted flex-1">
                Display price
                <input
                  defaultValue={s.displayPrice}
                  placeholder="140TND"
                  onBlur={(e) => patchSize(s.id, { displayPrice: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                />
              </label>
            </div>
          ))}
          {sizes.length === 0 && (
            <p className="text-muted text-sm text-center py-4">
              No sizes yet — add one on the Sizes page first.
            </p>
          )}
        </div>
      </section>

      {/* Palette pricing */}
      <section className="bg-surface border border-border-custom rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold">Palette pricing</h2>
            <p className="text-muted text-xs mt-1">
              Multiplier applied to a mosaic&apos;s size price, based on the color
              palette it was generated with (e.g. 1.1 = +10%).
            </p>
          </div>
          {palettesMessage && (
            <span className="text-sm text-accent shrink-0">{palettesMessage}</span>
          )}
        </div>
        <div className="space-y-2">
          {palettes.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 bg-bg border border-border-custom rounded-lg px-4 py-3"
            >
              <span className="font-semibold flex-1">
                {p.name}
                {p.enabled && (
                  <span className="ml-2 text-xs font-medium text-accent bg-accent/10 px-2 py-1 rounded">
                    Active
                  </span>
                )}
              </span>
              <label className="flex items-center gap-2 text-sm text-muted">
                Multiplier
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={p.priceMultiplier}
                  onBlur={(e) => patchPalette(p.id, Number(e.target.value) || 0)}
                  className="w-24 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                />
              </label>
            </div>
          ))}
          {palettes.length === 0 && (
            <p className="text-muted text-sm text-center py-4">
              No palettes yet — add one on the Palettes page first.
            </p>
          )}
        </div>
      </section>

      {/* Extra charges */}
      <section className="bg-surface border border-border-custom rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold">Extra charges</h2>
            <p className="text-muted text-xs mt-1">
              Added once per order, on top of the size price (shipping, packaging,
              services, ...). Add as many as you need.
            </p>
          </div>
          {chargesMessage && <span className="text-sm text-accent shrink-0">{chargesMessage}</span>}
        </div>

        <div className="space-y-2 mb-4">
          {charges.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 bg-bg border border-border-custom rounded-lg px-4 py-3"
            >
              <input
                defaultValue={c.name}
                onBlur={(e) => patchCharge(c.id, { name: e.target.value })}
                className="w-32 shrink-0 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm font-medium focus:outline-none focus:border-accent"
              />
              <label className="flex items-center gap-2 text-sm text-muted">
                Price (millimes)
                <input
                  type="number"
                  step="1"
                  min="0"
                  defaultValue={c.price}
                  onBlur={(e) => patchCharge(c.id, { price: Number(e.target.value) || 0 })}
                  className="w-28 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted flex-1">
                Display price
                <input
                  defaultValue={c.displayPrice}
                  placeholder="8TND"
                  onBlur={(e) => patchCharge(c.id, { displayPrice: e.target.value })}
                  className="flex-1 min-w-0 px-2 py-1.5 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) => patchCharge(c.id, { enabled: e.target.checked })}
                />
                Enabled
              </label>
              <button
                onClick={() => removeCharge(c.id)}
                className="text-xs text-muted hover:text-accent shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
          {charges.length === 0 && (
            <p className="text-muted text-sm text-center py-4">
              No extra charges yet — add shipping, packaging, or anything else below.
            </p>
          )}
        </div>

        <div className="flex items-end gap-3 pt-4 border-t border-border-custom">
          <div className="w-32">
            <label className="block text-xs text-muted mb-1">Name</label>
            <input
              value={newCharge.name}
              onChange={(e) => setNewCharge({ ...newCharge, name: e.target.value })}
              placeholder="Shipping"
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="w-32">
            <label className="block text-xs text-muted mb-1">Price (millimes)</label>
            <input
              type="number"
              min="0"
              value={newCharge.price}
              onChange={(e) => setNewCharge({ ...newCharge, price: Number(e.target.value) || 0 })}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-muted mb-1">Display price</label>
            <input
              value={newCharge.displayPrice}
              onChange={(e) => setNewCharge({ ...newCharge, displayPrice: e.target.value })}
              placeholder="8TND"
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
            />
          </div>
          <button
            onClick={addCharge}
            className="bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            + Add charge
          </button>
        </div>
      </section>

      {/* Marketing pricing plans */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Pricing plans</h2>
          <p className="text-muted text-sm mt-1">
            Marketing tiers and features shown on the landing page.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {message && <span className="text-sm text-accent">{message}</span>}
          <button
            onClick={() => setEditing({ ...EMPTY_PLAN, sortOrder: plans.length })}
            className="bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            + Add plan
          </button>
        </div>
      </div>

      {/* Plan list */}
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`bg-surface rounded-xl p-5 border ${
              plan.featured ? "border-accent" : "border-border-custom"
            }`}
          >
            {plan.featured && (
              <span className="text-accent text-xs font-bold uppercase tracking-widest">
                Featured
              </span>
            )}
            <h3 className="font-bold mt-1">{plan.name}</h3>
            <div className="mt-2">
              <span className="text-2xl font-black">{plan.price}</span>
              <span className="text-muted text-sm">{plan.period}</span>
            </div>
            <p className="text-muted text-xs mt-2">{plan.description}</p>
            <ul className="mt-3 space-y-1">
              {plan.features.map((f, i) => (
                <li key={i} className="text-xs text-muted flex items-center gap-1.5">
                  <span className="text-accent">&#10003;</span> {f.text}
                </li>
              ))}
            </ul>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setEditing({ ...plan, features: plan.features.map((f) => ({ ...f })) })}
                className="text-xs text-accent hover:text-accent-hover font-medium"
              >
                Edit
              </button>
              <button
                onClick={() => plan.id && deletePlan(plan.id)}
                className="text-xs text-muted hover:text-accent font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
        {plans.length === 0 && (
          <p className="text-muted text-sm col-span-3 text-center py-8">
            No pricing plans yet. Click &quot;+ Add plan&quot; to create one.
          </p>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border-custom rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h2 className="font-bold text-lg mb-4">
              {editing.id ? "Edit Plan" : "New Plan"}
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Name</label>
                  <input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                    placeholder="Pro"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-muted mb-1">Price</label>
                    <input
                      value={editing.price}
                      onChange={(e) => setEditing({ ...editing, price: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                      placeholder="$12"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1">Period</label>
                    <input
                      value={editing.period}
                      onChange={(e) => setEditing({ ...editing, period: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                      placeholder="/mo"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-muted mb-1">Description</label>
                <input
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">CTA text</label>
                  <input
                    value={editing.ctaText}
                    onChange={(e) => setEditing({ ...editing, ctaText: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">CTA link</label>
                  <input
                    value={editing.ctaLink}
                    onChange={(e) => setEditing({ ...editing, ctaLink: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.featured}
                  onChange={(e) => setEditing({ ...editing, featured: e.target.checked })}
                  className="accent-accent"
                />
                <span className="text-sm">Featured plan (highlighted)</span>
              </label>

              {/* Features */}
              <div>
                <label className="block text-xs text-muted mb-2">Features</label>
                <div className="space-y-1.5 mb-2">
                  {editing.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-accent text-xs">&#10003;</span>
                      <span className="flex-1">{f.text}</span>
                      <button
                        onClick={() => removeFeatureFromPlan(i)}
                        className="text-xs text-muted hover:text-accent"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={featureInput}
                    onChange={(e) => setFeatureInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addFeatureToPlan()}
                    placeholder="Add a feature..."
                    className="flex-1 px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                  />
                  <button
                    onClick={addFeatureToPlan}
                    className="text-sm text-accent hover:text-accent-hover font-medium px-3"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditing(null)}
                className="text-sm text-muted hover:text-text px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={savePlan}
                className="bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
              >
                {editing.id ? "Update" : "Create"} plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
