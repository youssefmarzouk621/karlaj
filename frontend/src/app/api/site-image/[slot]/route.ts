import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Serves an admin-uploaded homepage image (see SiteImage in @lego/database).
// URLs carry `?v=<updatedAt>` (lib/siteImages.ts), so a given URL is immutable
// and can be cached hard; a re-upload changes the URL.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slot: string }> }
) {
  const { slot } = await params;

  const image = await prisma.siteImage
    .findUnique({ where: { slot }, select: { data: true, mimeType: true, updatedAt: true } })
    .catch(() => null);
  if (!image) return new NextResponse(null, { status: 404 });

  const etag = `"${image.updatedAt.getTime()}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
    },
  });
}
