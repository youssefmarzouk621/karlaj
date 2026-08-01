import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { CART_COOKIE } from "@/lib/cart";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ artworkId: string }> }
) {
  const { artworkId } = await params;

  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE)?.value;
  const cart = token ? await prisma.cart.findUnique({ where: { token } }) : null;
  if (!cart) {
    return NextResponse.json({ error: "Cart not found" }, { status: 404 });
  }

  const item = await prisma.cartItem.findUnique({ where: { artworkId } });
  if (!item || item.cartId !== cart.id) {
    return NextResponse.json({ error: "Item not in cart" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.cartItem.delete({ where: { artworkId } }),
    prisma.artwork.update({
      where: { id: artworkId },
      data: { status: "REMOVED" },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
