"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Stepper from "@/components/Stepper";
import ImageUpload from "@/components/ImageUpload";
import SizeSelector, {
  MIN_STUDS,
  MAX_STUDS,
  bestFitSize,
  sizeCm,
  splitSizesForPhoto,
  type SizeOption,
} from "@/components/SizeSelector";
import { CENTERED, objectPosition, type CropPosition } from "@/lib/crop";
import SizePreview from "@/components/SizePreview";
import RoomPreview from "@/components/RoomPreview";
import GeneratingView from "@/components/GeneratingView";
import ResultViewer from "@/components/ResultViewer";
import PartsBreakdown from "@/components/PartsBreakdown";
import type { Placement, Part } from "@/lib/mosaicTypes";

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

/** Fallback wording when the server's reply carries no message of its own. */
function friendlyStatus(status: number): string {
  if (status === 413) return "That image is too large. Please choose one under 20 MB.";
  if (status >= 500) return "Something went wrong on our side. Please try again in a moment.";
  return "We couldn't build your mosaic. Please check your photo and try again.";
}

const STEPS = ["Upload photo", "Pick size", "Get your kit"];

export default function CreateFlow({
  sizes,
  customSizeEnabled,
  initialSize,
}: {
  sizes: SizeOption[];
  customSizeEnabled: boolean;
  /** Size to start on instead of the smallest enabled one (e.g. from the pricing page). */
  initialSize?: { width: number; height: number };
}) {
  const enabledSizes = sizes.filter((s) => s.enabled);
  // Envelope for the free numeric/drag controls: bounded by the enabled sizes.
  const dims = enabledSizes.flatMap((s) => [s.width, s.height]);
  const maxStud = dims.length ? Math.max(...dims) : MAX_STUDS;
  const minStud = dims.length ? Math.min(...dims) : MIN_STUDS;
  const defaultSize = initialSize ?? enabledSizes[0] ?? { width: minStud, height: minStud };

  const [step, setStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [width, setWidth] = useState(defaultSize.width);
  const [height, setHeight] = useState(defaultSize.height);
  // The photo's width / height (once loaded) and where the crop window sits on it.
  const [photoAspect, setPhotoAspect] = useState<number | null>(null);
  const [crop, setCrop] = useState<CropPosition>(CENTERED);
  // The crop the current result was generated from (the before/after photo follows it).
  const [resultCrop, setResultCrop] = useState<CropPosition>(CENTERED);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MosaicResult | null>(null);
  const [cartStatus, setCartStatus] = useState<
    "idle" | "adding" | "in-cart" | "removing"
  >("idle");
  const abortRef = useRef<AbortController | null>(null);

  const handleImageSelected = (f: File, url: string) => {
    setFile(f);
    setPreview(url);
    setPhotoAspect(null);
    setCrop(CENTERED);
    setResult(null);
    setError(null);
    setCartStatus("idle");
  };

  // Once the photo's shape is known, keep the current size if it's one of the
  // recommended ones (e.g. picked on the pricing page); otherwise switch to
  // the size that crops the least of it. Every size stays selectable.
  const handlePhotoDimensions = (w: number, h: number) => {
    const aspect = w / h;
    setPhotoAspect(aspect);
    const suits = splitSizesForPhoto(sizes, aspect).recommended.some(
      (s) => s.enabled && s.width === width && s.height === height
    );
    if (suits) return;
    const best = bestFitSize(sizes, aspect);
    if (best) {
      setWidth(best.width);
      setHeight(best.height);
    }
  };

  const handleGenerate = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;

    const formData = new FormData();
    formData.append("image", file);
    formData.append("width", String(width));
    formData.append("height", String(height));
    formData.append("crop_x", String(crop.x));
    formData.append("crop_y", String(crop.y));

    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? friendlyStatus(res.status));
      }
      const data: MosaicResult = await res.json();
      setResult(data);
      setResultCrop(crop);
      setCartStatus("idle");
      setStep(2);
    } catch (err: unknown) {
      // Cancelling isn't an error: back to the size step with nothing to report.
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(
          err instanceof TypeError
            ? "We couldn't reach the server. Check your connection and try again."
            : err instanceof Error
              ? err.message
              : "Something went wrong. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => abortRef.current?.abort();

  const handleStartOver = () => {
    setFile(null);
    setPreview(null);
    setPhotoAspect(null);
    setCrop(CENTERED);
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

  const sizeOption = sizes.find((s) => s.width === width && s.height === height);
  const resultSize = result
    ? sizes.find((s) => s.width === result.width && s.height === result.height)
    : undefined;

  if (loading) {
    return (
      <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 md:px-8">
        <GeneratingView photo={preview} width={width} height={height} onCancel={handleCancel} />
      </main>
    );
  }

  const primaryBtn =
    "h-14 px-8 rounded-full bg-accent hover:bg-accent-hover disabled:bg-surface-2 disabled:text-ink-3 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-on-accent font-semibold text-base inline-flex items-center justify-center gap-2.5 transition-all hover:-translate-y-px";
  const secondaryBtn =
    "h-14 px-6 rounded-full border border-line-strong bg-surface text-ink font-medium text-base hover:bg-surface-2 transition-colors";

  return (
    <main className="flex-1 w-full mx-auto flex flex-col">
      <div
        className={`w-full mx-auto px-4 md:px-8 pt-8 md:pt-12 flex flex-col gap-8 ${
          step === 0 ? "max-w-[1040px] pb-24" : step === 1 ? "max-w-[1240px] pb-10" : "max-w-[1312px] pb-24"
        }`}
      >
        {step < 2 && (
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="self-start inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors"
            >
              <ArrowLeftIcon />
              Back
            </Link>
            <h1 className="font-display font-normal text-5xl md:text-6xl leading-none tracking-[-0.025em]">
              Create your LEGO mosaic
            </h1>
          </div>
        )}

        <Stepper steps={STEPS} current={step} />

        {/* Step 1 — Upload */}
        {step === 0 && (
          <section className="flex flex-col gap-8">
            <div className="flex flex-col gap-2 mt-2">
              <h2 className="text-2xl font-semibold">Upload a photo</h2>
              <p className="text-base leading-relaxed text-ink-2">
                Pick a clear, high-contrast image — portraits, pets, logos, or landscapes all work.
                We&apos;ll center-crop it to match your mosaic size.
              </p>
            </div>
            <ImageUpload
              onImageSelected={handleImageSelected}
              onDimensions={handlePhotoDimensions}
              preview={preview}
            />
            <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-4">
              <span className="flex gap-2 items-center text-sm text-ink-2">
                <LockIcon />
                Your photo is only used to build your mosaic.
              </span>
              <button onClick={() => setStep(1)} disabled={!file} className={primaryBtn}>
                Continue
              </button>
            </div>
          </section>
        )}

        {/* Step 2 — Size + live preview */}
        {step === 1 && (
          <section className="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 mt-2">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold">Pick your size</h2>
                <p className="text-base leading-relaxed text-ink-2">
                  Bigger mosaics capture more detail but use more bricks and bags. The preview shows
                  exactly how your photo will be cropped.
                </p>
              </div>

              <SizeSelector
                sizes={sizes}
                width={width}
                height={height}
                minStud={minStud}
                maxStud={maxStud}
                customSizeEnabled={customSizeEnabled}
                photoAspect={photoAspect}
                onChange={(w, h) => {
                  setWidth(w);
                  setHeight(h);
                }}
              />

              <dl className="rounded-3xl bg-surface border border-line p-6 grid grid-cols-2 gap-x-4 gap-y-5">
                <div className="col-span-2 flex justify-between items-baseline pb-4 border-b border-line">
                  <dt className="sr-only">Selected size</dt>
                  <dd className="font-display text-4xl tracking-[-0.02em] leading-none">
                    {width} × {height}
                  </dd>
                  {sizeOption?.displayPrice && (
                    <dd className="text-[28px] font-semibold">{sizeOption.displayPrice}</dd>
                  )}
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[13px] text-ink-2">Finished size</dt>
                  <dd className="text-base font-semibold">{sizeCm(width, height)}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-[13px] text-ink-2">Studs</dt>
                  <dd className="text-base font-semibold">{(width * height).toLocaleString("en-US")}</dd>
                </div>
              </dl>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 items-start">
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
                photoAspect={photoAspect}
                crop={crop}
                onCropChange={setCrop}
              />
              <RoomPreview preview={preview} width={width} height={height} crop={crop} />
            </div>
          </section>
        )}

        {/* Step 3 — Result */}
        {step === 2 && result && (
          <section className="flex flex-col gap-8">
            <div className="flex flex-col gap-3 max-w-[820px]">
              <h2 className="font-display font-normal text-5xl md:text-6xl leading-none tracking-[-0.035em]">
                Your LEGO mosaic is ready
              </h2>
              <p className="text-[17px] leading-relaxed text-ink-2">
                Spin the 3D model, picture it on your wall, and compare it with your photo. The full
                parts list and bag-by-bag steps come in the printed manual and the downloadable PDF.
              </p>
            </div>

            <div className="grid lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] gap-6 items-start">
              <ResultViewer
                jobId={result.job_id}
                photo={preview}
                photoPosition={objectPosition(resultCrop)}
                gridRows={result.height}
                gridCols={result.width}
                placements={result.placements}
                colorMap={colorMap}
              />

              <aside className="lg:sticky lg:top-24 rounded-[32px] bg-surface border border-line shadow-md p-6 md:p-8 flex flex-col gap-6">
                <div className="flex flex-col gap-2.5">
                  <span className="self-start px-2.5 py-1 rounded-full bg-accent-soft text-accent-ink text-xs font-semibold">
                    Custom design
                  </span>
                  <h3 className="font-display font-normal text-[44px] leading-none tracking-[-0.02em]">
                    LEGO Mosaic
                  </h3>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-[18px]">
                  <Fact label="Size" value={`${result.width} × ${result.height} studs`} />
                  <Fact label="Finished" value={sizeCm(result.width, result.height)} />
                  <Fact label="Parts" value={result.total_parts.toLocaleString("en-US")} />
                  <Fact label="Colors" value={String(new Set(result.parts_list.map((p) => p.color_id)).size)} />
                </dl>
                {resultSize?.displayPrice && (
                  <>
                    <div className="h-px bg-line" />
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-ink-2">Price</span>
                      <span className="text-[32px] font-semibold tracking-[-0.01em]">
                        {resultSize.displayPrice}
                      </span>
                    </div>
                  </>
                )}
                <button
                  onClick={handleCartToggle}
                  disabled={cartStatus === "adding" || cartStatus === "removing"}
                  className={`h-14 rounded-full font-semibold text-base flex items-center justify-center gap-2.5 transition-all disabled:cursor-not-allowed disabled:opacity-60 active:scale-[.98] ${
                    cartStatus === "in-cart"
                      ? "border border-accent text-accent-ink bg-accent-soft hover:bg-surface"
                      : "bg-accent hover:bg-accent-hover text-on-accent hover:-translate-y-px"
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
                      <CartIcon />
                      Add to Cart
                    </>
                  )}
                </button>
                <a
                  href={`/api/pdf/${result.job_id}`}
                  download
                  className="h-[52px] rounded-full border border-line-strong bg-surface text-ink text-[15px] font-medium flex items-center justify-center gap-2.5 hover:bg-surface-2 transition-colors"
                >
                  <DownloadIcon />
                  Download Instructions PDF
                </a>
                <div className="flex justify-center gap-5 text-sm text-ink-2">
                  <button onClick={() => setStep(1)} className="hover:text-ink transition-colors">
                    Change size
                  </button>
                  <button onClick={handleStartOver} className="hover:text-ink transition-colors">
                    Start over
                  </button>
                </div>
              </aside>
            </div>

            <PartsBreakdown
              jobId={result.job_id}
              gridRows={result.height}
              gridCols={result.width}
              placements={result.placements}
              colorMap={colorMap}
              partsList={result.parts_list}
              totalParts={result.total_parts}
              bags={result.bags}
            />
          </section>
        )}
      </div>

      {/* Step 2 action bar, pinned to the bottom of the viewport. */}
      {step === 1 && (
        <div className="mt-auto sticky bottom-0 z-20 px-4 md:px-8 py-4 bg-glass backdrop-blur-[18px] border-t border-line">
          <div className="max-w-[1176px] mx-auto flex flex-col gap-3">
            {error && (
              <p role="alert" className="rounded-2xl bg-danger-soft text-danger text-sm px-4 py-3">
                {error}
              </p>
            )}
            <div className="flex items-center gap-3 md:gap-4">
              <button onClick={() => setStep(0)} className={secondaryBtn}>
                Back
              </button>
              <span className="ml-auto flex flex-col items-end">
                <span className="text-[13px] text-ink-2">
                  {width} × {height} · {sizeCm(width, height)}
                </span>
                {sizeOption?.displayPrice && (
                  <span className="text-xl font-semibold">{sizeOption.displayPrice}</span>
                )}
              </span>
              <button onClick={handleGenerate} className={primaryBtn}>
                Generate mosaic
                <ArrowRightIcon />
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="m-0 text-base font-semibold">{value}</dd>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </svg>
  );
}
