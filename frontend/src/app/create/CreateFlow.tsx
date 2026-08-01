"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Stepper from "@/components/Stepper";
import ImageUpload from "@/components/ImageUpload";
import SizeSelector, {
  MIN_STUDS,
  MAX_STUDS,
  type SizeOption,
} from "@/components/SizeSelector";
import SizePreview from "@/components/SizePreview";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import RoomMockups from "@/components/RoomMockups";
import FrameMockups, { hasFrameMockups } from "@/components/FrameMockups";
import type { Placement, Part } from "@/lib/mosaicTypes";

// WebGL can't render on the server, so load the 3D view client-only.
const Mosaic3D = dynamic(() => import("@/components/Mosaic3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center rounded-xl border border-border-custom bg-surface text-sm text-muted">
      Loading 3D preview…
    </div>
  ),
});

interface MosaicResult {
  job_id: string;
  artworkId: string;
  width: number;
  height: number;
  grid: number[][];
  placements: Placement[];
  parts_list: Part[];
  total_parts: number;
  bags: {
    bag_number: number;
    parts: Part[];
    total_parts: number;
    section: {
      row_start: number;
      row_end: number;
      col_start: number;
      col_end: number;
    };
  }[];
}

const STEPS = ["Upload photo", "Pick size", "Get your kit"];

export default function CreateFlow({
  sizes,
  customSizeEnabled,
}: {
  sizes: SizeOption[];
  customSizeEnabled: boolean;
}) {
  const enabledSizes = sizes.filter((s) => s.enabled);
  // Envelope for the free numeric/drag controls: bounded by the enabled sizes.
  const dims = enabledSizes.flatMap((s) => [s.width, s.height]);
  const maxStud = dims.length ? Math.max(...dims) : MAX_STUDS;
  const minStud = dims.length ? Math.min(...dims) : MIN_STUDS;
  const defaultSize = enabledSizes[0] ?? { width: minStud, height: minStud };

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [width, setWidth] = useState(defaultSize.width);
  const [height, setHeight] = useState(defaultSize.height);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MosaicResult | null>(null);
  const [cartStatus, setCartStatus] = useState<
    "idle" | "adding" | "in-cart" | "removing"
  >("idle");

  const handleImageSelected = (f: File, url: string) => {
    setFile(f);
    setPreview(url);
    setResult(null);
    setError(null);
    setCartStatus("idle");
  };

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("width", String(width));
    formData.append("height", String(height));

    try {
      const res = await fetch("/api/convert", { method: "POST", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Server error (${res.status})`);
      }
      const data: MosaicResult = await res.json();
      setResult(data);
      setCartStatus("idle");
      setStep(2);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setCartStatus("idle");
    setWidth(defaultSize.width);
    setHeight(defaultSize.height);
    setStep(0);
  };

  const handleCartToggle = async () => {
    if (!result) return;

    if (cartStatus === "in-cart") {
      setCartStatus("removing");
      try {
        const res = await fetch(`/api/cart/items/${result.artworkId}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to remove from cart");
        setCartStatus("idle");
        window.dispatchEvent(new Event("cart:updated"));
      } catch {
        setCartStatus("in-cart");
      }
      return;
    }

    setCartStatus("adding");
    try {
      const res = await fetch("/api/cart/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artworkId: result.artworkId }),
      });
      if (!res.ok) throw new Error("Failed to add to cart");
      setCartStatus("in-cart");
      window.dispatchEvent(new Event("cart:updated"));
    } catch {
      setCartStatus("idle");
    }
  };

  const colorMap: Record<number, [number, number, number]> = {};
  if (result) {
    for (const p of result.parts_list) {
      colorMap[p.color_id] = p.rgb;
    }
  }

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-3 py-8">
      <Link
        href="/"
        className="text-sm text-muted hover:text-text mb-6 inline-block transition-colors"
      >
        &larr; Back
      </Link>

      <h1 className="text-3xl font-bold mb-8">Create your LEGO mosaic</h1>

      <Stepper steps={STEPS} current={step} />

      {/* Step 1 — Upload */}
      {step === 0 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-1">Upload a photo</h2>
            <p className="text-muted text-sm">
              Pick a clear, high-contrast image — portraits, pets, logos, or
              landscapes all work. We&apos;ll center-crop it to match your
              mosaic size.
            </p>
          </div>
          <ImageUpload onImageSelected={handleImageSelected} preview={preview} />
          <button
            onClick={() => setStep(1)}
            disabled={!file}
            className="w-full bg-accent hover:bg-accent-hover disabled:bg-border-custom disabled:text-muted disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-lg"
          >
            Continue
          </button>
        </section>
      )}

      {/* Step 2 — Size + live preview */}
      {step === 1 && (
        <section className="space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-1">Pick your size</h2>
            <p className="text-muted text-sm">
              Bigger mosaics capture more detail but use more bricks and bags.
              The preview shows exactly how your photo will be cropped.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 items-start">
            <SizeSelector
              sizes={sizes}
              width={width}
              height={height}
              minStud={minStud}
              maxStud={maxStud}
              customSizeEnabled={customSizeEnabled}
              onChange={(w, h) => {
                setWidth(w);
                setHeight(h);
              }}
            />

            <SizePreview
              preview={preview}
              width={width}
              height={height}
              maxStud={maxStud}
              customSizeEnabled={customSizeEnabled}
              enabledSizes={enabledSizes}
              onChange={(w, h) => {
                setWidth(w);
                setHeight(h);
              }}
            />
          </div>

          {error && <p className="text-accent text-center text-sm">{error}</p>}

          <div className="flex gap-3">
            <button
              onClick={() => setStep(0)}
              disabled={loading}
              className="px-6 py-3 rounded-xl border border-border-custom text-muted hover:text-text hover:border-text/30 transition-colors font-medium disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="flex-1 bg-accent hover:bg-accent-hover disabled:bg-border-custom disabled:text-muted disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors text-lg flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              )}
              {loading ? "Building your mosaic..." : "Generate mosaic"}
            </button>
          </div>
        </section>
      )}

      {/* Step 3 — Result */}
      {step === 2 && result && (
        <section className="space-y-12">
          <div>
            <h2 className="text-xl font-bold mb-1">Your LEGO mosaic is ready</h2>
            <p className="text-muted text-sm">
              Spin the 3D model, picture it on your wall, and compare it with
              your photo. The full parts list and bag-by-bag steps come in the
              printed manual and the downloadable PDF.
            </p>
          </div>

          {/* 3D model of the finished mosaic */}
          <div className="grid gap-6 sm:grid-cols-10 sm:items-center">
            <div className="sm:col-span-7">
              <Mosaic3D
                key={result.job_id}
                gridRows={result.height}
                gridCols={result.width}
                placements={result.placements}
                colorMap={colorMap}
              />
            </div>
            <ResultBadge
              className="sm:col-span-3"
              icon={<CubeIcon />}
              label="3D Preview"
              title="See your LEGO® mosaic come to life"
              description="Explore your design in 3D and adjust the view from every angle."
            />
          </div>

          {/* See it in your space — photo frames where we have them, drawn scenes otherwise */}
          <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
            <ResultBadge
              className="sm:order-1"
              icon={<ImageIcon />}
              label="Image Preview"
              title="Visualize it in your space"
              description="See how your mosaic looks as wall art in a real-life setting."
            />
            <div className="sm:order-2">
              {hasFrameMockups(result.width, result.height) ? (
                <FrameMockups
                  gridRows={result.height}
                  gridCols={result.width}
                  placements={result.placements}
                  colorMap={colorMap}
                />
              ) : (
                <RoomMockups
                  gridRows={result.height}
                  gridCols={result.width}
                  placements={result.placements}
                  colorMap={colorMap}
                />
              )}
            </div>
          </div>

          {/* Before/after comparison */}
          <div className="grid gap-6 sm:grid-cols-2 sm:items-center">
            <BeforeAfterSlider
              key={result.job_id}
              beforeSrc={preview ?? ""}
              gridRows={result.height}
              gridCols={result.width}
              placements={result.placements}
              colorMap={colorMap}
            />
            <ResultBadge
              icon={<CompareIcon />}
              label="Before & After"
              title="From photo to brick masterpiece"
              description="See the magic of transformation from your photo to a LEGO® mosaic."
            />
          </div>

          {/* Ready to build + download */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <PdfIcon />
              </span>
              <div>
                <h3 className="font-semibold text-text">Ready to build?</h3>
                <p className="text-sm text-muted">
                  Download your personalized PDF instructions and start
                  building your masterpiece.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:shrink-0">
              <button
                onClick={handleCartToggle}
                disabled={cartStatus === "adding" || cartStatus === "removing"}
                className={`inline-flex items-center justify-center gap-2 font-medium px-5 py-2.5 rounded-lg transition-colors text-sm disabled:cursor-not-allowed disabled:opacity-60 ${
                  cartStatus === "in-cart"
                    ? "border border-accent text-accent hover:bg-accent/10"
                    : "border border-border-custom text-text hover:border-text/30"
                }`}
              >
                {(cartStatus === "adding" || cartStatus === "removing") && (
                  <span className="w-4 h-4 border-2 border-current/40 border-t-current rounded-full animate-spin" />
                )}
                {cartStatus === "adding" && "Adding…"}
                {cartStatus === "removing" && "Removing…"}
                {cartStatus === "in-cart" && "Remove from Cart"}
                {cartStatus === "idle" && (
                  <>
                    Add to Cart
                    <CartIcon />
                  </>
                )}
              </button>
              <a
                href={`/api/pdf/${result.job_id}`}
                download
                className="inline-flex shrink-0 items-center gap-2 bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                Download Instructions PDF
                <DownloadIcon />
              </a>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-3 rounded-xl border border-border-custom text-muted hover:text-text hover:border-text/30 transition-colors font-medium"
            >
              Change size
            </button>
            <button
              onClick={handleStartOver}
              className="px-6 py-3 rounded-xl border border-border-custom text-muted hover:text-text hover:border-text/30 transition-colors font-medium"
            >
              Start over
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

/** Icon + eyebrow label + heading + description, used next to each result preview. */
function ResultBadge({
  icon,
  label,
  title,
  description,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-3 flex items-center gap-2 text-accent">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <h3 className="text-xl font-bold text-text">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </div>
  );
}

function CartIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx={9} cy={20} r={1} />
      <circle cx={18} cy={20} r={1} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 12.2a1 1 0 0 0 1 .8h8.6a1 1 0 0 0 1-.8L20 8H6" />
    </svg>
  );
}

function CubeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5 12 3 3 7.5m18 0-9 4.5m9-4.5v9L12 21m0-9L3 7.5m9 4.5v9m-9-9v9l9 4.5" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x={3} y={3} width={18} height={18} rx={2} />
      <circle cx={8.5} cy={8.5} r={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 15-5-5L5 21" />
    </svg>
  );
}

function CompareIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M8 7 5 10l3 3M16 7l3 3-3 3" />
    </svg>
  );
}

function PdfIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3v5h5" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M4 19h16" />
    </svg>
  );
}
