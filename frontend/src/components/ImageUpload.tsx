"use client";

import { useCallback, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";

interface Props {
  onImageSelected: (file: File, preview: string) => void;
  /** The photo's pixel size, once it has loaded (drives the size step's orientation filter). */
  onDimensions?: (width: number, height: number) => void;
  preview: string | null;
}

const MAX_BYTES = 20 * 1024 * 1024;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;

function rejectionMessage(rej: FileRejection): { title: string; detail: string } {
  const code = rej.errors[0]?.code;
  if (code === "file-too-large") {
    return { title: `This file is ${mb(rej.file.size)}`, detail: "Choose a JPEG or PNG under 20 MB." };
  }
  if (code === "file-invalid-type") {
    return { title: "That file isn't a JPEG or PNG", detail: "Choose a JPEG or PNG under 20 MB." };
  }
  return { title: "We couldn't use that file", detail: rej.errors[0]?.message ?? "Try another photo." };
}

function UploadGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12" />
      <path d="m17 8-5-5-5 5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </svg>
  );
}

export default function ImageUpload({ onImageSelected, onDimensions, preview }: Props) {
  const [rejection, setRejection] = useState<{ title: string; detail: string } | null>(null);
  const [fileName, setFileName] = useState("");
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length) {
        setRejection(rejectionMessage(rejected[0]));
        return;
      }
      const file = accepted[0];
      if (!file) return;
      setRejection(null);
      setDims(null);
      setFileName(file.name);
      onImageSelected(file, URL.createObjectURL(file));
    },
    [onImageSelected]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [] },
    maxSize: MAX_BYTES,
    multiple: false,
  });

  // Ready: the dropzone keeps its frame and holds the photo like a pinned print.
  // It is still a dropzone — drop another image, or click, to replace it.
  if (preview && !rejection) {
    const small = dims ? Math.min(dims.w, dims.h) < 600 : false;
    return (
      <div
        {...getRootProps()}
        className={`min-h-[280px] rounded-[32px] flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10 p-6 cursor-pointer transition-colors ${
          isDragActive
            ? "border-2 border-solid border-accent bg-accent-soft"
            : "border-[1.5px] border-dashed border-line-strong bg-surface hover:border-accent"
        }`}
      >
        <input {...getInputProps()} />
        <span className="relative -rotate-3 bg-[#FBFAF8] px-2.5 pt-2.5 pb-[30px] shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Uploaded preview"
            onLoad={(e) => {
              const d = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
              setDims(d);
              onDimensions?.(d.w, d.h);
            }}
            className="block w-[168px] h-[168px] object-cover"
          />
          <span className="absolute left-2.5 bottom-2 max-w-[150px] truncate text-[11px] text-[#5C564E]">
            {fileName || "Your photo"}
          </span>
          <span className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full bg-success text-white grid place-items-center shadow-md">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
        </span>
        <span className="flex flex-col gap-2 max-w-[300px] text-center sm:text-left">
          <span className="text-xl font-semibold">{isDragActive ? "Release to replace" : "Photo ready"}</span>
          <span className="text-sm leading-relaxed text-ink-2">
            {dims && (
              <span className={small ? "text-danger" : ""}>
                {dims.w} × {dims.h} · {small ? "low resolution — fine detail may be lost" : "good resolution"}.{" "}
              </span>
            )}
            Drop another image here or{" "}
            <span className="text-accent-ink underline underline-offset-[3px]">browse</span> to replace it.
          </span>
        </span>
      </div>
    );
  }

  // Rejected file.
  if (rejection) {
    return (
      <div
        {...getRootProps()}
        role="alert"
        className="min-h-[400px] rounded-[32px] border-[1.5px] border-dashed border-danger bg-danger-soft flex flex-col items-center justify-center gap-3.5 p-8 text-center cursor-pointer"
      >
        <input {...getInputProps()} />
        <span className="w-14 h-14 rounded-full bg-surface text-danger grid place-items-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </span>
        <span className="text-base font-semibold">{rejection.title}</span>
        <span className="text-sm leading-normal text-ink-2">{rejection.detail}</span>
        <button
          type="button"
          onClick={open}
          className="h-11 px-[18px] rounded-full border border-line-strong bg-surface text-ink text-sm font-medium"
        >
          Choose another photo
        </button>
      </div>
    );
  }

  // Empty / drag-over.
  return (
    <div
      {...getRootProps()}
      className={`min-h-[400px] rounded-[32px] flex flex-col items-center justify-center gap-5 p-8 text-center cursor-pointer transition-all duration-200 ${
        isDragActive
          ? "border-2 border-solid border-accent bg-accent-soft scale-[1.01] shadow-[0_0_0_6px_var(--accent-soft)]"
          : "border-[1.5px] border-dashed border-line-strong bg-surface hover:border-accent hover:bg-bg"
      }`}
    >
      <input {...getInputProps()} />
      <span
        className={`w-[88px] h-[88px] rounded-2xl bg-accent text-on-accent grid place-items-center shadow-lg transition-transform ${
          isDragActive ? "-translate-y-1" : ""
        }`}
      >
        <UploadGlyph size={30} />
      </span>
      {isDragActive ? (
        <span className="text-xl font-semibold text-accent-ink">Release to upload</span>
      ) : (
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[22px] font-semibold">
            Drop an image here, or{" "}
            <span className="text-accent-ink underline underline-offset-4">click to browse</span>
          </span>
          <span className="text-[15px] text-ink-2">JPEG or PNG, up to 20 MB</span>
        </div>
      )}
    </div>
  );
}
