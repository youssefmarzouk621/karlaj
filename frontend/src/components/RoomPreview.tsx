"use client";

import { useEffect, useState } from "react";
import { RoomScene } from "@/components/RoomMockups";
import { getFrameMockups } from "@/lib/frameMockups";
import { sizeCm } from "@/lib/studs";
import { cropRect, type CropPosition } from "@/lib/crop";

interface Props {
  /** The customer's photo (object URL). */
  preview: string | null;
  width: number;
  height: number;
  /** Where the crop window sits on the photo (as chosen in the crop preview). */
  crop: CropPosition;
}

/**
 * The customer's photo cropped to the chosen size and placed in the first
 * "in your space" scene, so they can picture the finished piece before
 * generating. Uses a real photo mockup when this size has one, else a drawn room.
 */
export default function RoomPreview({ preview, width, height, crop }: Props) {
  // The photo cropped to this size's aspect ratio — what the mosaic will show.
  const [cropped, setCropped] = useState<string | null>(null);

  useEffect(() => {
    if (!preview) return;
    let stale = false;
    const img = new Image();
    img.onload = () => {
      if (stale) return;
      const target = width / height;
      const { sx, sy, sw, sh } = cropRect(img.naturalWidth, img.naturalHeight, target, crop);
      const long = 440;
      const canvas = document.createElement("canvas");
      canvas.width = target >= 1 ? long : Math.round(long * target);
      canvas.height = target >= 1 ? Math.round(long / target) : long;
      canvas
        .getContext("2d")
        ?.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      setCropped(canvas.toDataURL("image/jpeg", 0.88));
    };
    img.src = preview;
    return () => {
      stale = true;
    };
  }, [preview, width, height, crop]);

  const frame = getFrameMockups(width, height)[0];

  return (
    <div className="rounded-[28px] bg-surface-2 p-5 flex flex-col gap-3.5">
      <span className="flex justify-between text-[13px] font-semibold">
        In your space
        <span className="font-normal text-ink-2">{frame?.label ?? "Living room"}</span>
      </span>

      <div className="relative overflow-hidden rounded-2xl bg-surface">
        {frame ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.src}
              alt={`Your photo framed in a ${frame.label.toLowerCase()} setting`}
              className="block w-full"
            />
            {cropped && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cropped}
                alt=""
                aria-hidden="true"
                className="absolute bg-white"
                style={{
                  left: `${frame.rect.left}%`,
                  top: `${frame.rect.top}%`,
                  width: `${frame.rect.width}%`,
                  height: `${frame.rect.height}%`,
                  objectFit: "fill",
                  boxShadow: "0 1px 8px rgba(0,0,0,0.28)",
                }}
              />
            )}
          </>
        ) : (
          <div className="aspect-[4/3]">
            <RoomScene variant="living" label="Living room" gridRows={height} gridCols={width} src={cropped} />
          </div>
        )}
      </div>

      <span className="text-[13px] text-ink-2">
        About {sizeCm(width, height)} of finished bricks, shown to scale in the room.
      </span>
    </div>
  );
}
