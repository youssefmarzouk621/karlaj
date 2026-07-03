"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

interface Props {
  onImageSelected: (file: File, preview: string) => void;
  preview: string | null;
}

export default function ImageUpload({ onImageSelected, preview }: Props) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      onImageSelected(file, url);
    },
    [onImageSelected]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "image/jpeg": [], "image/png": [] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
        isDragActive
          ? "border-accent bg-accent/10"
          : "border-border-custom hover:border-accent/40 bg-surface"
      }`}
    >
      <input {...getInputProps()} />
      {preview ? (
        <img
          src={preview}
          alt="Uploaded preview"
          className="mx-auto max-h-64 rounded-lg"
        />
      ) : (
        <div className="text-muted">
          <p className="text-lg font-medium mb-1 text-text">
            Drop an image here, or click to browse
          </p>
          <p className="text-sm">JPEG or PNG, up to 20 MB</p>
        </div>
      )}
    </div>
  );
}
