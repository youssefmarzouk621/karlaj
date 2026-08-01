import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { CART_COOKIE } from "@/lib/cart";
import CartView from "./CartView";
import type { Placement, Part } from "@/lib/mosaicTypes";

export interface CartArtwork {
  artworkId: string;
  width: number;
  height: number;
  placements: Placement[];
  partsList: Part[];
  totalParts: number;
  price: number;
  // Stored renders (frontend/src/lib/server/artworkImages.ts) — mainUrl null
  // for artworks generated before that existed, or if rendering failed;
  // CartView falls back to the live canvas draw in that case. previews are
  // the mockup-composited variants (PREVIEW_1/PREVIEW_2), shown as a row.
  mainUrl: string | null;
  mainWidth: number | null;
  mainHeight: number | null;
  previews: { url: string; width: number; height: number }[];
}

export interface CartCharge {
  id: string;
  name: string;
  price: number;
  displayPrice: string;
}

// The cart cookie makes this request-specific — never cache/prerender it.
export const dynamic = "force-dynamic";

export default async function CartPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE)?.value;

  const [cart, charges] = await Promise.all([
    token
      ? prisma.cart.findUnique({
          where: { token },
          include: {
            items: {
              include: {
                artwork: { include: { images: true } },
              },
              orderBy: { createdAt: "desc" },
            },
          },
        })
      : null,
    prisma.extraCharge.findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } }),
  ]);

  // Price was computed once, when the item was added to the cart (size price
  // x palette multiplier), and stored on the CartItem — read it straight off
  // there rather than recomputing from current pricing config.
  const items: CartArtwork[] = (cart?.items ?? []).map((item) => {
    const main = item.artwork.images.find((img) => img.kind === "MAIN");
    const previews = item.artwork.images
      .filter((img) => img.kind === "PREVIEW_1" || img.kind === "PREVIEW_2")
      .sort((a, b) => a.kind.localeCompare(b.kind))
      .map((img) => ({ url: img.url, width: img.width, height: img.height }));
    return {
      artworkId: item.artworkId,
      width: item.artwork.width,
      height: item.artwork.height,
      placements: item.artwork.placements as unknown as Placement[],
      partsList: item.artwork.partsList as unknown as Part[],
      totalParts: item.artwork.totalParts,
      price: item.price,
      mainUrl: main?.url ?? null,
      mainWidth: main?.width ?? null,
      mainHeight: main?.height ?? null,
      previews,
    };
  });

  const cartCharges: CartCharge[] = charges.map((c) => ({
    id: c.id,
    name: c.name,
    price: c.price,
    displayPrice: c.displayPrice,
  }));

  return <CartView items={items} charges={cartCharges} />;
}
