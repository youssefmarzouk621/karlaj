import { NextRequest, NextResponse } from "next/server";
import {
  prisma,
  SITE_IMAGE_MAX_BYTES,
  SITE_IMAGE_MIME_TYPES,
  SITE_IMAGE_SLOT_IDS,
} from "@/lib/db";
import { requireAdmin } from "@/lib/requireAdmin";

type Ctx = { params: Promise<{ slot: string }> };

const unknownSlot = () => NextResponse.json({ error: "Unknown image slot" }, { status: 404 });
const isSlot = (slot: string) => SITE_IMAGE_SLOT_IDS.includes(slot);

// GET -> the uploaded image's bytes (for the dashboard preview).
export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { slot } = await params;
  if (!isSlot(slot)) return unknownSlot();

  const image = await prisma.siteImage.findUnique({ where: { slot } });
  if (!image) return new NextResponse(null, { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: { "Content-Type": image.mimeType, "Cache-Control": "private, max-age=0, must-revalidate" },
  });
}

// PUT multipart/form-data { file?, alt, title, meta }. A file replaces the image;
// without one only the text fields change (and a first save needs a file, since
// a row without bytes is meaningless).
export async function PUT(request: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { slot } = await params;
  if (!isSlot(slot)) return unknownSlot();

  const form = await request.formData();
  const file = form.get("file");
  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
  const fields = { alt: text("alt", 255), title: text("title", 100), meta: text("meta", 100) };

  if (file instanceof File && file.size > 0) {
    if (!(SITE_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: "Use a PNG, JPEG or WebP image." }, { status: 400 });
    }
    if (file.size > SITE_IMAGE_MAX_BYTES) {
      return NextResponse.json(
        { error: `Image is too large (max ${SITE_IMAGE_MAX_BYTES / 1024 / 1024} MB).` },
        { status: 400 }
      );
    }
    const data = Buffer.from(await file.arrayBuffer());
    await prisma.siteImage.upsert({
      where: { slot },
      create: { slot, mimeType: file.type, data, ...fields },
      update: { mimeType: file.type, data, ...fields },
    });
  } else {
    const existing = await prisma.siteImage.findUnique({ where: { slot }, select: { slot: true } });
    if (!existing) {
      return NextResponse.json({ error: "Choose an image to upload first." }, { status: 400 });
    }
    await prisma.siteImage.update({ where: { slot }, data: fields });
  }

  return NextResponse.json({ ok: true });
}

// DELETE -> drop the upload so the slot falls back to the bundled default.
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { slot } = await params;
  if (!isSlot(slot)) return unknownSlot();
  await prisma.siteImage.deleteMany({ where: { slot } });
  return NextResponse.json({ ok: true });
}
