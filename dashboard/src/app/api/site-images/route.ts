import { NextResponse } from "next/server";
import { prisma, SITE_IMAGE_SLOTS } from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";

// Where the public site (and its bundled default artwork) is served from.
const FRONTEND_URL = (process.env.FRONTEND_URL ?? "http://localhost:3000").replace(/\/$/, "");

// GET /api/site-images -> every homepage slot with its current state. The image
// bytes are not included; the page loads them from /api/site-images/[slot].
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const rows = await prisma.siteImage.findMany({
    select: { slot: true, alt: true, title: true, meta: true, updatedAt: true },
  });
  const byslot = new Map(rows.map((r) => [r.slot, r]));

  return NextResponse.json({
    slots: SITE_IMAGE_SLOTS.map((s) => {
      const row = byslot.get(s.slot);
      return {
        slot: s.slot,
        label: s.label,
        hint: s.hint,
        captioned: !!s.captioned,
        defaultUrl: `${FRONTEND_URL}${s.defaultSrc}`,
        uploaded: !!row,
        // What the homepage shows right now: the saved text, else the default.
        alt: row?.alt || s.defaultAlt,
        title: s.captioned ? row?.title || s.defaultTitle : "",
        meta: s.captioned ? row?.meta || s.defaultMeta : "",
        version: row ? row.updatedAt.getTime() : null,
      };
    }),
  });
}
