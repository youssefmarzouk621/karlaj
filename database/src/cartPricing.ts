import type { Prisma, PrismaClient } from "@prisma/client";

/**
 * A cart's money lives in the database, not in the render: `carts.subtotal` /
 * `carts.total` (millimes) hold what the customer was shown, and the extra
 * charges behind `total - subtotal` are snapshotted row by row into
 * `cart_extra_charges` — name and price copied, plus the FK back to the source
 * `ExtraCharge` so an order can still be audited after the admin edits or
 * deletes it.
 *
 * `repriceCart` is the only writer of any of that. Every mutation of a cart's
 * contents has to call it, in the same transaction as the mutation, or the
 * stored totals drift from the items.
 */

/** Works with the client itself or with a `$transaction` callback's client. */
type Db = PrismaClient | Prisma.TransactionClient;

export interface CartTotals {
  /** Sum of the items' prices, frozen when each was added. */
  subtotal: number;
  /** Sum of the extra charges applied to the cart. */
  chargesTotal: number;
  /** What the customer pays: `subtotal + chargesTotal`. */
  total: number;
}

/**
 * Recompute a cart's totals from its items and the currently enabled extra
 * charges, then persist both the totals and a fresh snapshot of the charges.
 * Returns the new totals so callers can hand them straight back to the client.
 */
export async function repriceCart(db: Db, cartId: string): Promise<CartTotals> {
  const items = await db.cartItem.findMany({
    where: { cartId },
    select: { price: true },
  });
  const subtotal = items.reduce((sum, item) => sum + item.price, 0);

  // Extra charges are per-order, so an empty cart carries none — otherwise
  // removing the last item would leave a cart that costs shipping and nothing
  // else.
  const charges = items.length
    ? await db.extraCharge.findMany({
        where: { enabled: true },
        orderBy: { sortOrder: "asc" },
      })
    : [];
  const chargesTotal = charges.reduce((sum, charge) => sum + charge.price, 0);
  const total = subtotal + chargesTotal;

  // Re-snapshot wholesale instead of diffing: the charges on a cart are
  // whatever was enabled, and priced how, the last time the cart changed.
  await db.cartExtraCharge.deleteMany({ where: { cartId } });
  if (charges.length) {
    await db.cartExtraCharge.createMany({
      data: charges.map((charge) => ({
        cartId,
        extraChargeId: charge.id,
        name: charge.name,
        price: charge.price,
        displayPrice: charge.displayPrice,
        sortOrder: charge.sortOrder,
      })),
    });
  }

  await db.cart.update({ where: { id: cartId }, data: { subtotal, total } });

  return { subtotal, chargesTotal, total };
}
