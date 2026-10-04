"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Familjen_Grotesk } from "next/font/google";

const serif = Familjen_Grotesk({ subsets: ["latin"], style: ["normal", "italic"] });

interface Slot {
  slot: string;
  label: string;
  hint: string;
  captioned: boolean;
  defaultUrl: string;
  uploaded: boolean;
  alt: string;
  title: string;
  meta: string;
  version: number | null;
}

// Unsaved edits for one slot. Absent = nothing changed.
interface Draft {
  file: File | null;
  alt: string;
  title: string;
  meta: string;
}

// The public site's light palette, scoped to the preview so it reads like the
// real homepage inside the dark dashboard.
const PAGE_VARS = {
  "--p-bg": "#F5F2EC",
  "--p-surface": "#FFFFFF",
  "--p-surface2": "#EDE8E0",
  "--p-ink": "#1B1916",
  "--p-ink2": "#5C564E",
  "--p-line": "rgba(27,25,22,.10)",
  "--p-accent": "#C2401E",
  "--p-accent-ink": "#A8361A",
  "--p-accent-soft": "#F5E3DB",
} as React.CSSProperties;

const inputClass =
  "w-full px-3 py-2 rounded-lg bg-bg border border-border-custom text-text text-sm focus:outline-none focus:border-accent";

export default function SiteImagesPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("compare_before");
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/site-images");
    const data = await res.json();
    setSlots(data.slots ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/site-images")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots ?? []);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const flash = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 3000);
  };

  const bySlot = useMemo(() => new Map(slots.map((s) => [s.slot, s])), [slots]);

  // Object URLs for chosen-but-unsaved files, so the preview updates immediately.
  const blobUrls = useMemo(() => {
    const urls: Record<string, string> = {};
    for (const [slot, d] of Object.entries(drafts)) if (d.file) urls[slot] = URL.createObjectURL(d.file);
    return urls;
  }, [drafts]);
  useEffect(() => () => Object.values(blobUrls).forEach((u) => URL.revokeObjectURL(u)), [blobUrls]);

  const srcOf = (slot: string) => {
    const s = bySlot.get(slot);
    if (!s) return "";
    if (blobUrls[slot]) return blobUrls[slot];
    return s.uploaded ? `/api/site-images/${slot}?v=${s.version}` : s.defaultUrl;
  };

  const draftOf = (s: Slot): Draft => drafts[s.slot] ?? { file: null, alt: s.alt, title: s.title, meta: s.meta };
  const isDirty = (s: Slot) => {
    const d = drafts[s.slot];
    return !!d && (!!d.file || d.alt !== s.alt || d.title !== s.title || d.meta !== s.meta);
  };
  const edit = (s: Slot, patch: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [s.slot]: { ...draftOf(s), ...patch } }));
  const clearDraft = (slot: string) =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });

  const save = async (s: Slot) => {
    const d = draftOf(s);
    setBusy(true);
    const form = new FormData();
    if (d.file) form.set("file", d.file);
    form.set("alt", d.alt);
    form.set("title", d.title);
    form.set("meta", d.meta);
    const res = await fetch(`/api/site-images/${s.slot}`, { method: "PUT", body: form });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) {
      clearDraft(s.slot);
      await load();
      flash("Saved");
    } else {
      flash(data.error ?? "Error saving");
    }
  };

  const reset = async (s: Slot) => {
    if (!confirm("Remove this upload and go back to the built-in image?")) return;
    setBusy(true);
    const res = await fetch(`/api/site-images/${s.slot}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      clearDraft(s.slot);
      await load();
      flash("Reset to default");
    } else {
      flash("Error resetting");
    }
  };

  // ── Preview pieces ──────────────────────────────────────────────────────

  /** An image on the mock homepage: click to edit it. */
  const pic = ({
    slot,
    className = "",
    imgClassName = "",
    imgStyle,
    badge = true,
  }: {
    slot: string;
    className?: string;
    imgClassName?: string;
    imgStyle?: React.CSSProperties;
    badge?: boolean;
  }) => {
    const s = bySlot.get(slot);
    if (!s) return null;
    const on = selected === slot;
    return (
      <button
        type="button"
        onClick={() => setSelected(slot)}
        aria-label={`Edit ${s.label}`}
        aria-pressed={on}
        data-testid={`pic-${slot}`}
        className={`group relative block overflow-hidden text-left outline-none ${className} ${
          on ? "ring-[3px] ring-[var(--p-accent)] ring-offset-2 ring-offset-[var(--p-bg)]" : "ring-0"
        }`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={srcOf(slot)} alt={s.alt || s.label} draggable={false} className={`block w-full h-full object-cover ${imgClassName}`} style={imgStyle} />
        <span className="absolute inset-0 grid place-items-center bg-black/0 group-hover:bg-black/45 transition-colors">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-full bg-white text-[#1B1916] text-xs font-semibold shadow">
            Replace
          </span>
        </span>
        {badge && (isDirty(s) || s.uploaded) && (
          <span
            className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isDirty(s) ? "bg-[#E8A84C] text-black" : "bg-[var(--p-accent)] text-white"
            }`}
          >
            {isDirty(s) ? "Unsaved" : "Custom"}
          </span>
        )}
      </button>
    );
  };

  const eyebrow = "text-[10px] tracking-[.14em] uppercase font-semibold text-[var(--p-accent-ink)]";
  const title = `${serif.className} font-normal leading-none tracking-[-0.02em] text-[var(--p-ink)]`;

  const current = bySlot.get(selected);

  return (
    <div className="max-w-[1180px]">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Homepage images</h1>
        {message && <span className="text-sm text-highlight">{message}</span>}
      </div>
      <p className="text-muted text-sm mb-6 max-w-2xl">
        This is your homepage. Click any image to replace it. Only upload images you have the rights to use
        — people, brands and artwork you don&apos;t own can cause legal problems. Slots with no upload show
        the built-in artwork.
      </p>

      {loading ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
          {/* ── Mock homepage ── */}
          <div
            style={PAGE_VARS}
            className="rounded-2xl overflow-hidden border border-border-custom bg-[var(--p-bg)] text-[var(--p-ink)] select-none"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-12 border-b border-[var(--p-line)]">
              <span className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-md bg-[var(--p-accent)]" />
                <span className={`${serif.className} text-xl leading-none`}>BrickArt</span>
              </span>
              <span className="text-[10px] text-[var(--p-ink2)]">Home · Features · Pricing</span>
            </div>

            {/* Hero (3D scene isn't editable) */}
            <div className="grid grid-cols-[5fr_7fr] gap-6 px-6 pt-8 pb-10 items-center">
              <div className="space-y-3">
                <h2 className={`${serif.className} text-[44px] leading-[.95] tracking-[-0.03em]`}>
                  Your photo.
                  <br />
                  <em className="text-[var(--p-accent)]">In bricks.</em>
                </h2>
                <p className="text-[11px] leading-relaxed text-[var(--p-ink2)] max-w-[230px]">
                  Upload any image and get a real, buildable LEGO mosaic kit.
                </p>
              </div>
              <div className="h-44 rounded-2xl bg-[#151413] grid place-items-center text-[11px] text-[#A9A399] text-center px-4">
                Live 3D LEGO scene
                <br />
                (not an image — nothing to edit)
              </div>
            </div>

            {/* Before & after */}
            <div className="grid grid-cols-[4fr_7fr] gap-6 px-6 pb-10 items-center">
              <div className="space-y-2">
                <span className={eyebrow}>Before &amp; after</span>
                <h3 className={`${title} text-[28px]`}>From photo to brick masterpiece</h3>
              </div>
              <div className="relative grid grid-cols-2 gap-1 rounded-2xl overflow-hidden">
                {pic({ slot: "compare_before", className: "aspect-square rounded-l-2xl" })}
                {pic({ slot: "compare_after", className: "aspect-square rounded-r-2xl" })}
                <span className="pointer-events-none absolute top-2 left-2 translate-y-6 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">
                  Before
                </span>
                <span className="pointer-events-none absolute top-2 right-2 translate-y-6 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-semibold">
                  After
                </span>
              </div>
            </div>

            {/* How it works */}
            <div className="px-6 pb-10 space-y-4 border-t border-[var(--p-line)] pt-6">
              <div className="space-y-1">
                <span className={eyebrow}>How it works</span>
                <h3 className={`${title} text-[28px]`}>Three steps to the wall</h3>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["01", "Upload a photo"],
                  ["02", "Pick a size"],
                  ["03", "Get your kit"],
                ].map(([n, t]) => (
                  <div key={n} className="rounded-2xl bg-[var(--p-surface)] border border-[var(--p-line)] p-4 h-32 flex flex-col">
                    <span className={`${serif.className} text-3xl leading-none text-[var(--p-accent)]`}>{n}</span>
                    {n === "02" && (
                      <div className="mt-2">
                        {pic({ slot: "sizes_art", className: "w-12 h-12 rounded-md", badge: false })}
                      </div>
                    )}
                    <span className="mt-auto text-xs font-semibold">{t}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3D preview */}
            <div className="mx-6 mb-10 rounded-2xl bg-[#151413] text-[#F2EEE7] grid grid-cols-[5fr_7fr] overflow-hidden">
              <div className="p-6 flex flex-col justify-center gap-2">
                <span className="text-[10px] tracking-[.14em] uppercase font-semibold text-[#F08A66]">3D preview</span>
                <h3 className={`${serif.className} text-[26px] leading-none tracking-[-0.02em]`}>
                  See your LEGO® mosaic come to life
                </h3>
              </div>
              <div className="relative h-52 grid place-items-center [perspective:900px] bg-[radial-gradient(circle_at_60%_40%,#2A2826,#151413_70%)]">
                {pic({
                  slot: "preview_3d",
                  className: "w-36 h-36",
                  imgStyle: { transform: "rotateX(52deg) rotateZ(-30deg)", boxShadow: "14px 28px 28px rgba(0,0,0,.6)" },
                })}
              </div>
            </div>

            {/* Gallery */}
            <div className="px-6 pb-10 space-y-4 border-t border-[var(--p-line)] pt-6">
              <div className="space-y-1">
                <span className={eyebrow}>Gallery</span>
                <h3 className={`${title} text-[28px]`}>Built with BrickArt</h3>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[1, 2, 3, 4].map((n) => {
                  const slot = `gallery_${n}`;
                  const s = bySlot.get(slot);
                  if (!s) return null;
                  const d = draftOf(s);
                  return (
                    <div key={slot} className="rounded-2xl bg-[var(--p-surface)] border border-[var(--p-line)] p-2 space-y-2">
                      {pic({ slot, className: "aspect-square rounded-xl" })}
                      <div className="px-1 pb-1 min-h-9">
                        <div className="text-[11px] font-semibold truncate">{d.title}</div>
                        <div className="text-[10px] text-[var(--p-ink2)] truncate">{d.meta}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Sizes */}
            <div className="px-6 pb-8 space-y-4 border-t border-[var(--p-line)] pt-6">
              <div className="space-y-1">
                <span className={eyebrow}>Sizes</span>
                <h3 className={`${title} text-[28px]`}>From desk to wall</h3>
              </div>
              <div className="relative rounded-2xl bg-gradient-to-b from-[#E6E2DB] to-[#D9D5CE] overflow-hidden flex items-end justify-center gap-8 pt-8 pb-14">
                <div className="absolute inset-x-0 bottom-0 h-10 bg-[#C8C3BB] border-t border-[#B9B4AC]" />
                {[
                  ["16 × 16", 36, 3],
                  ["48 × 48", 88, 4],
                  ["96 × 96", 136, 5],
                ].map(([label, px, border]) => (
                  <div key={label as string} className="relative flex flex-col items-center gap-2">
                    {pic({
                      slot: "sizes_art",
                      badge: false,
                      className: "shrink-0",
                      imgStyle: { width: px as number, height: px as number, border: `${border}px solid #1B1916` },
                    })}
                    <span className="text-[10px] font-semibold text-[#1B1916]">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Edit panel ── */}
          <aside className="sticky top-6 bg-surface border border-border-custom rounded-2xl p-5 space-y-4">
            {current ? (
              <>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{current.label}</h2>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        current.uploaded ? "bg-accent/10 text-accent" : "bg-bg text-muted"
                      }`}
                    >
                      {current.uploaded ? "Custom" : "Default"}
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-1">{current.hint}</p>
                </div>

                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={srcOf(current.slot)}
                  alt={current.label}
                  className="w-full aspect-square rounded-xl object-cover bg-bg border border-border-custom"
                />

                <label className="block">
                  <span className="sr-only">Choose an image</span>
                  <input
                    key={current.slot + (drafts[current.slot]?.file ? "f" : "")}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    data-testid="site-image-file"
                    onChange={(e) => edit(current, { file: e.target.files?.[0] ?? null })}
                    className="block w-full text-sm text-muted file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-accent file:text-white file:font-medium file:cursor-pointer"
                  />
                  <span className="block text-[11px] text-muted mt-1">PNG, JPEG or WebP, up to 4 MB.</span>
                </label>

                <label className="block text-xs text-muted">
                  Alt text
                  <input
                    value={draftOf(current).alt}
                    onChange={(e) => edit(current, { alt: e.target.value })}
                    placeholder="Describe the image"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                {current.captioned && (
                  <>
                    <label className="block text-xs text-muted">
                      Title
                      <input
                        value={draftOf(current).title}
                        onChange={(e) => edit(current, { title: e.target.value })}
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                    <label className="block text-xs text-muted">
                      Size / pieces line
                      <input
                        value={draftOf(current).meta}
                        onChange={(e) => edit(current, { meta: e.target.value })}
                        className={`${inputClass} mt-1`}
                      />
                    </label>
                  </>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => save(current)}
                    disabled={!isDirty(current) || busy}
                    className="flex-1 px-4 py-2 rounded-lg bg-accent hover:bg-accent-hover text-white text-sm font-medium disabled:opacity-40 transition-colors"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  {isDirty(current) && (
                    <button
                      onClick={() => clearDraft(current.slot)}
                      disabled={busy}
                      className="px-3 py-2 rounded-lg border border-border-custom text-muted hover:text-text text-sm transition-colors"
                    >
                      Discard
                    </button>
                  )}
                </div>
                {current.uploaded && (
                  <button
                    onClick={() => reset(current)}
                    disabled={busy}
                    className="w-full text-xs text-muted hover:text-text underline underline-offset-2"
                  >
                    Remove upload and use the default
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-muted">Select an image on the page.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
