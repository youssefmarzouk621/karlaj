"use client";

import { useState } from "react";
import Link from "next/link";
import Stepper from "@/components/Stepper";
import ImageUpload from "@/components/ImageUpload";
import SizeSelector from "@/components/SizeSelector";
import BeforeAfterSlider from "@/components/BeforeAfterSlider";
import PartsList from "@/components/PartsList";

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

            <div>
              <p className="text-xs text-muted mb-2">Crop preview</p>
              <div
                className="w-full rounded-xl border border-border-custom bg-surface overflow-hidden"
                style={{ aspectRatio: `${width} / ${height}` }}
              >
                {preview && (
                  <img
                    src={preview}
                    alt="Crop preview"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <p className="text-xs text-muted mt-2">
                {width}&times;{height} studs
              </p>
            </div>
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
            <h2 className="text-xl font-bold mb-1">Your LEGO kit is ready</h2>
            <p className="text-muted text-sm">
              Review the mosaic preview and parts list below, then download
              the instruction booklet to start building.
            </p>
          </div>

          <BeforeAfterSlider
            key={result.job_id}
            beforeSrc={preview ?? ""}
            gridRows={result.height}
            gridCols={result.width}
            placements={result.placements}
            colorMap={colorMap}
          />

          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Parts &amp; bags</h3>
            <a
              href={`/api/pdf/${result.job_id}`}
              download
              className="bg-accent hover:bg-accent-hover text-white font-medium px-5 py-2 rounded-lg transition-colors text-sm"
            >
              Download instruction PDF
            </a>
          </div>
          <PartsList
            partsList={result.parts_list}
            bags={result.bags}
            totalParts={result.total_parts}
          />

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
