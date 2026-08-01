import { NextRequest, NextResponse } from "next/server";
import { getMosaicServiceUrl } from "@/lib/mosaicService";
import { prisma } from "@/lib/db";
import { generateArtworkImages } from "@/lib/server/artworkImages";

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  const res = await fetch(`${getMosaicServiceUrl()}/process`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    return NextResponse.json(
      { error: text },
      { status: res.status }
    );
  }

  const data = await res.json();

  // Link to the matching catalog size (for direct price access) when the
  // generated dimensions match one; null for custom sizes that don't. Also
  // link to the palette that was enabled for this generation (the generator
  // always builds from the single enabled palette) so the pair can be priced
  // together when the artwork is added to a cart.
  const [size, palette] = await Promise.all([
    prisma.mosaicSize.findUnique({
      where: { width_height: { width: data.width, height: data.height } },
    }),
    prisma.palette.findFirst({ where: { enabled: true } }),
  ]);

  // Persist every generation so it can be added to a cart later.
  const artwork = await prisma.artwork.create({
    data: {
      jobId: data.job_id,
      sizeId: size?.id,
      paletteId: palette?.id,
      width: data.width,
      height: data.height,
      grid: data.grid,
      placements: data.placements,
      partsList: data.parts_list,
      totalParts: data.total_parts,
      bags: data.bags,
    },
  });

  // Render the high-fidelity image + cart-sized previews once, here, instead
  // of recomputing them on a <canvas> every time the artwork is displayed.
  // Best-effort: a rendering failure shouldn't block getting the mosaic data
  // back to the customer — callers fall back to the live client-side draw
  // when an artwork has no stored images.
  try {
    const images = await generateArtworkImages(artwork.id, {
      width: data.width,
      height: data.height,
      placements: data.placements,
      partsList: data.parts_list,
    });
    await prisma.artworkImage.createMany({
      data: images.map((img) => ({ artworkId: artwork.id, ...img })),
    });
  } catch (err) {
    console.error(`Failed to generate images for artwork ${artwork.id}:`, err);
  }

  return NextResponse.json({ ...data, artworkId: artwork.id });
}
