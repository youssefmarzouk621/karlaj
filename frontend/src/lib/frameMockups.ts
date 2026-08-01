// Photo frame mockups, keyed by mosaic size. Each frame photo
// (frontend/public/mockups/) has a painted "empty" window (no real
// transparency), so the mosaic is rendered and laid exactly over that
// opening — the frame border stays visible around it. `rect` was measured
// from the PNGs as a percentage of the image, with a small overscan so no
// window edge peeks out. Shared between the client-side create-flow result
// page (FrameMockups.tsx) and the server-side artwork-image renderer, so the
// measurements only live in one place.
export interface FrameMockup {
  src: string;
  label: string;
  rect: { left: number; top: number; width: number; height: number };
}

export const FRAME_SETS: Record<string, FrameMockup[]> = {
  "32x32": [
    {
      src: "/mockups/1_mockup_32x32.png",
      label: "Living room",
      rect: { left: 23.8, top: 17.3, width: 34.2, height: 34.0 },
    },
    {
      src: "/mockups/2_mockup_32x32.png",
      label: "Kitchen shelf",
      rect: { left: 28.3, top: 16.1, width: 64.4, height: 67.2 },
    },
  ],
  "64x64": [
    {
      src: "/mockups/1_mockup_64x64.png",
      label: "Living room",
      rect: { left: 29.8, top: 18.1, width: 42.3, height: 42.3 },
    },
    {
      src: "/mockups/2_mockup_64x64.png",
      label: "Console shelf",
      rect: { left: 26.2, top: 19.0, width: 48.3, height: 48.3 },
    },
  ],
};

/** Whether a photo-frame mockup set exists for this size. */
export function hasFrameMockups(width: number, height: number): boolean {
  return `${width}x${height}` in FRAME_SETS;
}

/** The frame mockups for this size, or an empty array if none exist. */
export function getFrameMockups(width: number, height: number): FrameMockup[] {
  return FRAME_SETS[`${width}x${height}`] ?? [];
}
