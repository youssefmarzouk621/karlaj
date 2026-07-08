"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Stepper from "@/components/Stepper";
import ImageUpload from "@/components/ImageUpload";
import SizeSelector from "@/components/SizeSelector";
import SizePreview from "@/components/SizePreview";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import RoomMockups from "@/components/RoomMockups";
import FrameMockups from "@/components/FrameMockups";

// WebGL can't render on the server, so load the 3D view client-only.
const Mosaic3D = dynamic(() => import("@/components/Mosaic3D"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] items-center justify-center rounded-xl border border-border-custom bg-surface text-sm text-muted">
      Loading 3D preview…
    </div>
  ),
});

interface Placement {
  part_id: string;
  part_name: string;
  color_id: number;
  row: number;
  col: number;
  brick_width: number;
  brick_height: number;
}

interface Part {
  part_id: string;
  part_name: string;
  color_id: number;
  color_name: string;
  rgb: [number, number, number];
  quantity: number;
}

interface MosaicResult {
  job_id: string;
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

export default function CreatePage() {
  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [width, setWidth] = useState(48);
  const [height, setHeight] = useState(48);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MosaicResult | null>(null);

  const handleImageSelected = (f: File, url: string) => {
    setFile(f);
    setPreview(url);
    setResult(null);
    setError(null);
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
    setWidth(48);
    setHeight(48);
    setStep(0);
  };

  const colorMap: Record<number, [number, number, number]> = {};
  if (result) {
    for (const p of result.parts_list) {
      colorMap[p.color_id] = p.rgb;
    }
  }

  return (
    <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-12">
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
              width={width}
              height={height}
              onChange={(w, h) => {
                setWidth(w);
                setHeight(h);
              }}
            />

            <SizePreview
              preview={preview}
              width={width}
              height={height}
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
        <section className="space-y-8">
          <div>
            <h2 className="text-xl font-bold mb-1">Your LEGO mosaic is ready</h2>
            <p className="text-muted text-sm">
              Spin the 3D model, picture it on your wall, and compare it with
              your photo. The full parts list and bag-by-bag steps come in the
              printed manual and the downloadable PDF.
            </p>
          </div>

          {/* 3D model of the finished mosaic */}
          <Mosaic3D
            key={result.job_id}
            gridRows={result.height}
            gridCols={result.width}
            placements={result.placements}
            colorMap={colorMap}
          />

          {/* See it in your space — photo frames for 32×32, drawn scenes otherwise */}
          <div>
            <h3 className="text-lg font-semibold mb-3">See it in your space</h3>
            {result.width === 32 && result.height === 32 ? (
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

          {/* Compact before/after + download */}
          <div className="grid gap-6 sm:grid-cols-2 sm:items-start">
            <div>
              <h3 className="text-lg font-semibold mb-3">Before &amp; after</h3>
              <div className="mx-auto max-w-xs sm:mx-0">
                <BeforeAfterSlider
                  key={result.job_id}
                  beforeSrc={preview ?? ""}
                  gridRows={result.height}
                  gridCols={result.width}
                  placements={result.placements}
                  colorMap={colorMap}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border-custom bg-surface p-5">
              <h3 className="text-lg font-semibold mb-1">Ready to build</h3>
              <p className="text-muted text-sm mb-4">
                Your box ships with a printed step-by-step manual and the full
                parts list. Grab the same guide as a PDF here.
              </p>
              <a
                href={`/api/pdf/${result.job_id}`}
                download
                className="inline-block bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                Download instruction PDF
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
