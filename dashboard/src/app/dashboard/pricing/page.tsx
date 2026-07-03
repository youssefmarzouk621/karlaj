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

export default function PricingPage() {
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Pricing Plans</h1>
          <p className="text-muted text-sm mt-1">Manage pricing tiers and features</p>
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
