// How the customer's photo maps onto a mosaic size: which sizes suit its
// shape, how much of it a size crops away, and where the crop window sits.
// The generator crops with the same rule (mosaic-generator/mosaic.py
// `crop_to_ratio`), so what is previewed here is what gets built.

export type Orientation = "portrait" | "landscape" | "square";

/** Aspect ratios within this of 1 count as square (photos are rarely exact). */
export const SQUARE_TOLERANCE = 0.05;

/** Below this crop, a size is shown as using the full photo. */
export const FULL_PHOTO_CROP = 0.02;

export function orientationOf(width: number, height: number): Orientation {
  const aspect = width / height;
  if (Math.abs(aspect - 1) <= SQUARE_TOLERANCE) return "square";
  return aspect < 1 ? "portrait" : "landscape";
}

/** Share of the photo (0..1) cut away when it's cropped to `sizeAspect`. */
export function cropFraction(photoAspect: number, sizeAspect: number): number {
  return 1 - Math.min(photoAspect / sizeAspect, sizeAspect / photoAspect);
}

/**
 * Crop window position, 0..1 per axis (0.5 = centered), with the same meaning
 * as CSS `object-position: X% Y%` and as the generator's `crop_x`/`crop_y`.
 */
export interface CropPosition {
  x: number;
  y: number;
}

export const CENTERED: CropPosition = { x: 0.5, y: 0.5 };

export const objectPosition = (p: CropPosition) => `${p.x * 100}% ${p.y * 100}%`;

/**
 * The source rectangle of a `photoW`×`photoH` image that a mosaic of aspect
 * `sizeAspect` keeps, for drawing the crop onto a canvas.
 */
export function cropRect(photoW: number, photoH: number, sizeAspect: number, p: CropPosition) {
  let sw = photoW;
  let sh = sw / sizeAspect;
  if (sh > photoH) {
    sh = photoH;
    sw = sh * sizeAspect;
  }
  return { sx: (photoW - sw) * p.x, sy: (photoH - sh) * p.y, sw, sh };
}
