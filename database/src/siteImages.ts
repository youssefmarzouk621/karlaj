/**
 * The image slots on the public homepage that an admin can replace from the
 * dashboard (rows of `site_images`, see `SiteImage` in the schema). The
 * dashboard builds its form from this list and the frontend uses it to resolve
 * each slot to an uploaded image or its bundled default — one catalog so the
 * two never drift.
 */

export interface SiteImageSlot {
  slot: string;
  label: string;
  /** Where it appears and what suits it, shown next to the uploader. */
  hint: string;
  /** Slot shows a title + meta line under the image. */
  captioned?: boolean;
  /** Bundled fallback in the frontend's /public (used when no row exists). */
  defaultSrc: string;
  /** Alt text — and, for captioned slots, title/size line — used until an admin sets their own. */
  defaultAlt: string;
  defaultTitle: string;
  defaultMeta: string;
}

export const SITE_IMAGE_SLOTS: SiteImageSlot[] = [
  {
    slot: "compare_before",
    label: "Before / after — original photo",
    hint: "The \"before\" half of the slider. Use a photo you own the rights to. Square works best.",
    defaultSrc: "/home/default-compare_before.jpg",
    defaultAlt: "Original photo",
    defaultTitle: "",
    defaultMeta: "",
  },
  {
    slot: "compare_after",
    label: "Before / after — mosaic",
    hint: "The \"after\" half: the mosaic made from the photo above, same framing.",
    defaultSrc: "/home/default-compare_after.png",
    defaultAlt: "The same photo as a LEGO mosaic",
    defaultTitle: "",
    defaultMeta: "",
  },
  {
    slot: "preview_3d",
    label: "3D preview mosaic",
    hint: "Shown tilted in the dark \"See your mosaic come to life\" panel. Square mosaic.",
    defaultSrc: "/home/default-preview_3d.png",
    defaultAlt: "LEGO mosaic in 3D",
    defaultTitle: "",
    defaultMeta: "",
  },
  {
    slot: "sizes_art",
    label: "Sizes — artwork",
    hint: "One mosaic shown at 16×16, 48×48 and 96×96 in \"From desk to wall\" (and as the step-2 thumbnail). Square.",
    defaultSrc: "/home/default-sizes_art.png",
    defaultAlt: "LEGO mosaic",
    defaultTitle: "",
    defaultMeta: "",
  },
  ...[
    ["Sunset over mountains as a LEGO mosaic", "Sunset Ridge", "48 × 48 · 2,304 studs"],
    ["Ocean waves as a LEGO mosaic", "Ocean Swell", "32 × 32 · 1,024 studs"],
    ["A pink flower as a LEGO mosaic", "Pink Bloom", "48 × 48 · 2,304 studs"],
    ["A night skyline as a LEGO mosaic", "Midnight City", "48 × 48 · 2,304 studs"],
  ].map(([alt, title, meta], i) => ({
    slot: `gallery_${i + 1}`,
    label: `Gallery — card ${i + 1}`,
    hint: "Square mosaic image plus the title and size line under it.",
    captioned: true,
    defaultSrc: `/home/default-gallery_${i + 1}.png`,
    defaultAlt: alt,
    defaultTitle: title,
    defaultMeta: meta,
  })),
];

export const SITE_IMAGE_SLOT_IDS = SITE_IMAGE_SLOTS.map((s) => s.slot);

/** Accepted upload types and size cap (enforced by the dashboard API). */
export const SITE_IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const SITE_IMAGE_MAX_BYTES = 4 * 1024 * 1024;
