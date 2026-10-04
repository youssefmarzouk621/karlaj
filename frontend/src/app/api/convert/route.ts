import { NextRequest, NextResponse } from "next/server";
import { getMosaicServiceUrl } from "@/lib/mosaicService";
import { prisma, Prisma } from "@/lib/db";
import type { Part, Placement } from "@/lib/mosaicTypes";
import { generateArtworkImages } from "@/lib/server/artworkImages";

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });

/** A customer-readable message for an error from the mosaic service. */
function friendlyUpstreamError(status: number, body: string): string {
  let detail: unknown;
  try {
    detail = JSON.parse(body).detail;
  } catch {
    /* not JSON */
  }
  if (status === 400 && typeof detail === "string") {
    // The service's own validation messages (size, file type, 20 MB limit) already read well.
    if (/decode|unsupported|corrupt/i.test(detail)) {
      return "We couldn't read that image. Please try a different JPEG or PNG.";
    }
    return detail;
  }
  if (status === 413) return "That image is too large. Please choose one under 20 MB.";
  return "Our mosaic builder ran into a problem. Please try again in a moment.";
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();

  let res: Response;
  try {
    res = await fetch(`${getMosaicServiceUrl()}/process`, {
      method: "POST",
      body: formData,
    });
  } catch (err) {
    // The generator isn't running / reachable.
    console.error("Mosaic service unreachable:", err);
    return error(
      "Our mosaic builder is temporarily unavailable. Please try again in a few minutes.",
      503
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error(`Mosaic service returned ${res.status}: ${text.slice(0, 300)}`);
    return error(friendlyUpstreamError(res.status, text), res.status >= 500 ? 502 : res.status);
  }

  try {
    return await saveAndRespond(await res.json());
  } catch (err) {
    console.error("Failed to save the generated mosaic:", err);
    return error("We built your mosaic but couldn't save it. Please try again.", 500);
  }
}

interface MosaicData {
  job_id: string;
  width: number;
  height: number;
  grid: Prisma.InputJsonValue;
  placements: Placement[];
  parts_list: Part[];
  total_parts: number;
  bags: Prisma.InputJsonValue;
}

async function saveAndRespond(data: MosaicData) {
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
      placements: data.placements as unknown as Prisma.InputJsonValue,
      partsList: data.parts_list as unknown as Prisma.InputJsonValue,
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
