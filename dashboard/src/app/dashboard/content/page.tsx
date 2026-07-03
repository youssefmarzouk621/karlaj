"use client";

import { useState, useEffect } from "react";

interface HeroData {
  id?: string;
  title: string;
  titleAccent: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

interface FeatureData {
  id?: string;
  title: string;
  description: string;
  icon: string;
  sortOrder: number;
}

const EMPTY_HERO: HeroData = {
  title: "Your photo.",
  titleAccent: "In bricks.",
  subtitle: "Upload any image and get a real, buildable LEGO mosaic kit.",
  ctaText: "Start building",
  ctaLink: "/create",
};

export default function ContentPage() {
  const [hero, setHero] = useState<HeroData>(EMPTY_HERO);
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/content")
      .then((r) => r.json())
      .then((data) => {
        if (data.hero) setHero(data.hero);
        if (data.features) setFeatures(data.features);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    setMessage("");
    const res = await fetch("/api/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hero, features }),
    });
    setSaving(false);
    setMessage(res.ok ? "Saved" : "Error saving");
    setTimeout(() => setMessage(""), 3000);
  };

  const addFeature = () => {
    setFeatures([
      ...features,
      { title: "", description: "", icon: "40+", sortOrder: features.length },
    ]);
  };

  const updateFeature = (idx: number, field: keyof FeatureData, value: string | number) => {
    setFeatures(features.map((f, i) => (i === idx ? { ...f, [field]: value } : f)));
  };

  const removeFeature = (idx: number) => {
    setFeatures(features.filter((_, i) => i !== idx));
  };

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Landing Page Content</h1>
          <p className="text-muted text-sm mt-1">Edit hero section and features</p>
        </div>
        <div className="flex items-center gap-3">
          {message && (
            <span className="text-sm text-accent">{message}</span>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <section className="bg-surface border border-border-custom rounded-xl p-6 mb-6">
        <h2 className="font-bold mb-4">Hero Section</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">Title</label>
              <input
                value={hero.title}
                onChange={(e) => setHero({ ...hero, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Title accent</label>
              <input
                value={hero.titleAccent}
                onChange={(e) => setHero({ ...hero, titleAccent: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-sm text-accent focus:outline-none focus:border-accent"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Subtitle</label>
            <textarea
              value={hero.subtitle}
              onChange={(e) => setHero({ ...hero, subtitle: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-muted mb-1">CTA button text</label>
              <input
                value={hero.ctaText}
                onChange={(e) => setHero({ ...hero, ctaText: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">CTA link</label>
              <input
                value={hero.ctaLink}
                onChange={(e) => setHero({ ...hero, ctaLink: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-surface border border-border-custom rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold">Features</h2>
          <button
            onClick={addFeature}
            className="text-sm text-accent hover:text-accent-hover font-medium"
          >
            + Add feature
          </button>
        </div>

        <div className="space-y-4">
          {features.map((f, i) => (
            <div
              key={f.id || i}
              className="bg-bg border border-border-custom rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-xs text-muted">Feature {i + 1}</span>
                <button
                  onClick={() => removeFeature(i)}
                  className="text-xs text-muted hover:text-accent"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-[60px_1fr] gap-3 mb-3">
                <div>
                  <label className="block text-xs text-muted mb-1">Icon</label>
                  <input
                    value={f.icon}
                    onChange={(e) => updateFeature(i, "icon", e.target.value)}
                    className="w-full px-2 py-2 rounded-lg bg-surface border border-border-custom text-text text-sm text-center focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Title</label>
                  <input
                    value={f.title}
                    onChange={(e) => updateFeature(i, "title", e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">Description</label>
                <textarea
                  value={f.description}
                  onChange={(e) => updateFeature(i, "description", e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-surface border border-border-custom text-text text-sm focus:outline-none focus:border-accent resize-none"
                />
              </div>
            </div>
          ))}
          {features.length === 0 && (
            <p className="text-muted text-sm text-center py-4">
              No features yet. Click &quot;+ Add feature&quot; to create one.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
