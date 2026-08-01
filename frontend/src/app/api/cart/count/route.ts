import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { CART_COOKIE } from "@/lib/cart";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(CART_COOKIE)?.value;
  const count = token
    ? await prisma.cartItem.count({ where: { cart: { token } } })
    : 0;

  return NextResponse.json({ count });
}
