import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { CART_COOKIE, CART_COOKIE_MAX_AGE } from "@/lib/cart";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const artworkId = body?.artworkId;
  if (!artworkId || typeof artworkId !== "string") {
    return NextResponse.json({ error: "artworkId is required" }, { status: 400 });
  }

  const artwork = await prisma.artwork.findUnique({
    where: { id: artworkId },
    include: { size: true, palette: true },
  });
  if (!artwork) {
    return NextResponse.json({ error: "Artwork not found" }, { status: 404 });
  }

  // Price is computed once, here, from the size's base price and the
  // palette's multiplier — and stored on the cart item, so later admin edits
  // to pricing don't change what's already in a cart.
  const price = Math.round((artwork.size?.price ?? 0) * (artwork.palette?.priceMultiplier ?? 1));

  const cookieStore = await cookies();
  let token = cookieStore.get(CART_COOKIE)?.value;
  let cart = token ? await prisma.cart.findUnique({ where: { token } }) : null;

  if (!cart) {
    token = randomUUID();
    cart = await prisma.cart.create({ data: { token } });
    cookieStore.set(CART_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: CART_COOKIE_MAX_AGE,
    });
  }

  await prisma.$transaction([
    prisma.cartItem.upsert({
      where: { artworkId },
      create: { cartId: cart.id, artworkId, price },
      update: { cartId: cart.id, price },
    }),
    prisma.artwork.update({
      where: { id: artworkId },
      data: { status: "LOCKED" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
