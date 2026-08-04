import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { prisma, repriceCart } from "@/lib/db";
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

  const cartId = cart.id;
  const totals = await prisma.$transaction(async (tx) => {
    await tx.cartItem.upsert({
      where: { artworkId },
      create: { cartId, artworkId, price },
      update: { cartId, price },
    });
    await tx.artwork.update({
      where: { id: artworkId },
      data: { status: "LOCKED" },
    });
    // Same transaction as the mutation, so the cart's stored total is never
    // out of step with its items.
    return repriceCart(tx, cartId);
  });

  return NextResponse.json({ ok: true, ...totals });
}
