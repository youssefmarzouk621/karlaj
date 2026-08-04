"use client";

import { memo, useCallback, useMemo, useState } from "react";
import Link from "next/link";
import MosaicPreview from "@/components/MosaicPreview";
import type { CartArtwork, CartCharge } from "./page";

// Checkout itself isn't wired up yet, so these upsells stay a preview — swap
// for real add-ons once checkout exists. Size pricing and extra charges
// (shipping, packaging, ...) below are real, admin-configured data.
const ADDONS: {
  name: string;
  description: string;
  icon: React.ReactNode;
  // Bundled into the package at no extra cost — no price, no Add button.
  included?: boolean;
  price?: number;
}[] = [
  {
    name: "Premium Frame Kit",
    description: "Display your mosaic gallery-style with a matching wood frame.",
    included: true,
    icon: <FrameIcon />,
  },
  {
    name: "Gift Packaging",
    description: "Protective wrap and a gift box, ready to hand over.",
    price: 9.99,
    icon: <GiftIcon />,
  },
];

// Sums are in millimes (1 TND = 1000 millimes); per-item/charge prices use
// the admin-entered display string directly.
function formatMillimes(millimes: number): string {
  return `${(millimes / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 })} TND`;
}

function estimateBuildTime(totalParts: number): string {
  const hours = Math.max(1, Math.round(totalParts / 220));
  return hours <= 1 ? "~1 hr" : `${hours - 1}–${hours} hrs`;
}

function estimateDifficulty(totalParts: number): string {
  if (totalParts < 300) return "Beginner";
  if (totalParts < 900) return "Intermediate";
  return "Advanced";
}

function formatPrice(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function CartView({
  items: initialItems,
  charges,
  subtotal: initialSubtotal,
  total: initialTotal,
}: {
  items: CartArtwork[];
  charges: CartCharge[];
  subtotal: number;
  total: number;
}) {
  const [items, setItems] = useState(initialItems);
  // Totals are the server's — never summed here — so the figure on screen is
  // the one stored on the cart row. Removing an item reprices server-side and
  // hands the new totals back, which is what this state holds.
  const [totals, setTotals] = useState({ subtotal: initialSubtotal, total: initialTotal });
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Stable reference (empty deps — only touches setState functions, which
  // React guarantees are stable) so it doesn't bust CartItemCard's memoization
  // on every CartView render.
  const handleRemove = useCallback(async (artworkId: string) => {
    setRemovingId(artworkId);
    setError(null);
    try {
      const res = await fetch(`/api/cart/items/${artworkId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove item");
      const { subtotal, total } = await res.json();
      setItems((prev) => prev.filter((item) => item.artworkId !== artworkId));
      setTotals({ subtotal, total });
      window.dispatchEvent(new Event("cart:updated"));
    } catch {
      setError("Couldn't remove that item. Try again.");
    } finally {
      setRemovingId(null);
    }
  }, []);

  const showPreviewNotice = (label: string) =>
    setNotice(`${label} isn't available yet — this is a preview.`);

  if (items.length === 0) {
    return (
      <main className="flex-1 max-w-4xl mx-auto w-full px-3 py-20 text-center">
        <h1 className="text-3xl font-bold mb-3">Your cart is empty</h1>
        <p className="text-muted mb-8">
          Generate a mosaic and add it to your cart to see it here.
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-xl transition-colors"
        >
          Create a mosaic
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 max-w-6xl mx-auto w-full px-3 py-8">
      <Link
        href="/create"
        className="text-sm text-muted hover:text-text mb-6 inline-flex items-center gap-1.5 transition-colors"
      >
        <ArrowLeftIcon /> Continue shopping
      </Link>

      <h1 className="text-3xl font-bold mb-1">Your cart</h1>
      <p className="text-muted text-sm mb-8">
        {items.length} {items.length === 1 ? "mosaic" : "mosaics"} ready to build
      </p>

      {error && <p className="text-accent text-sm mb-4">{error}</p>}

      <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
        {/* Items */}
        <div className="space-y-5">
          {items.map((item) => (
            <CartItemCard
              key={item.artworkId}
              item={item}
              removing={removingId === item.artworkId}
              onRemove={handleRemove}
            />
          ))}

          {/* Upsells */}
          <section className="pt-6">
            <h2 className="text-xl font-bold mb-4">What comes with the package</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ADDONS.map((addon) => (
                <div
                  key={addon.name}
                  className="rounded-xl border border-border-custom bg-surface p-4 flex items-center gap-4"
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                    {addon.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-text text-sm">{addon.name}</h3>
                    <p className="text-xs text-muted mt-0.5">{addon.description}</p>
                    <div className="flex items-center justify-between mt-2">
                      {addon.included ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-highlight">
                          <CheckCircleIcon /> Included
                        </span>
                      ) : (
                        <>
                          <span className="text-sm font-bold text-text">{formatPrice(addon.price!)}</span>
                          <button
                            onClick={() => showPreviewNotice(addon.name)}
                            className="text-xs font-medium border border-border-custom rounded-lg px-3 py-1.5 text-muted hover:text-text hover:border-text/30 transition-colors"
                          >
                            Add
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Order summary */}
        <aside className="rounded-2xl border border-border-custom bg-surface p-6 lg:sticky lg:top-24 space-y-5">
          <h2 className="text-lg font-bold text-text">Order summary</h2>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">
                Subtotal ({items.length} {items.length === 1 ? "item" : "items"})
              </span>
              <span className="text-text" data-testid="cart-subtotal">
                {formatMillimes(totals.subtotal)}
              </span>
            </div>
            {charges.map((c) => (
              <div key={c.id} className="flex justify-between" data-testid="cart-charge">
                <span className="text-muted">{c.name}</span>
                <span className="text-text">{c.displayPrice || formatMillimes(c.price)}</span>
              </div>
            ))}
          </div>

          <div className="border-t border-border-custom pt-4 flex items-center justify-between">
            <span className="font-semibold text-text">Total</span>
            <div className="text-right">
              <div className="text-xl font-bold text-text" data-testid="cart-total">
                {formatMillimes(totals.total)}
              </div>
            </div>
          </div>

          <button
            onClick={() => showPreviewNotice("Checkout")}
            className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <LockIcon /> Proceed to checkout
          </button>

          {notice && <p className="text-xs text-center text-muted">{notice}</p>}

          <div className="flex gap-2">
            <button
              onClick={() => showPreviewNotice("Google Pay")}
              className="flex-1 border border-border-custom rounded-lg py-2.5 text-sm font-medium text-muted hover:text-text hover:border-text/30 transition-colors"
            >
              Google Pay
            </button>
            <button
              onClick={() => showPreviewNotice("Apple Pay")}
              className="flex-1 border border-border-custom rounded-lg py-2.5 text-sm font-medium text-muted hover:text-text hover:border-text/30 transition-colors"
            >
              Apple Pay
            </button>
          </div>

          <ul className="space-y-3 pt-2 border-t border-border-custom">
            <li className="flex items-center gap-3 text-xs text-muted">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <LockIcon />
              </span>
              <div>
                <p className="font-medium text-text">Secure checkout</p>
                <p>Your details stay encrypted end to end.</p>
              </div>
            </li>
            <li className="flex items-center gap-3 text-xs text-muted">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <TruckIcon />
              </span>
              <div>
                <p className="font-medium text-text">Fast, reliable delivery</p>
                <p>Bricks and instructions shipped together.</p>
              </div>
            </li>
            <li className="flex items-center gap-3 text-xs text-muted">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <ShieldIcon />
              </span>
              <div>
                <p className="font-medium text-text">Satisfaction guaranteed</p>
                <p>Missing a piece? We&apos;ll ship a replacement.</p>
              </div>
            </li>
          </ul>
        </aside>
      </div>
    </main>
  );
}

// Split out and memoized so that state changes elsewhere in CartView (removing
// a *different* item, a promo/checkout notice, an error banner, ...) don't
// force every other item's canvas to redraw. `colorMap` is rebuilt only when
// this item's own parts list changes, keeping the MosaicPreview effect's
// dependency stable across unrelated re-renders.
const CartItemCard = memo(function CartItemCard({
  item,
  removing,
  onRemove,
}: {
  item: CartArtwork;
  removing: boolean;
  onRemove: (artworkId: string) => void;
}) {
  const colorMap = useMemo(() => {
    const map: Record<number, [number, number, number]> = {};
    for (const p of item.partsList) map[p.color_id] = p.rgb;
    return map;
  }, [item.partsList]);

  const priceLabel = item.price > 0 ? formatMillimes(item.price) : "Pricing TBD";

  return (
    <div className="rounded-2xl border border-border-custom bg-surface p-5 sm:flex gap-6">
      <div className="sm:w-56 shrink-0 mb-4 sm:mb-0">
        {item.mainUrl ? (
          <div className="overflow-hidden rounded-xl border border-border-custom bg-surface p-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized
                static PNG rendered at creation time; next/image's on-request
                optimization pipeline would add nothing here. */}
            <img
              src={item.mainUrl}
              alt="LEGO mosaic"
              width={item.mainWidth ?? undefined}
              height={item.mainHeight ?? undefined}
              loading="lazy"
              className="mx-auto block w-full h-auto rounded-lg"
            />
          </div>
        ) : (
          <MosaicPreview
            gridRows={item.height}
            gridCols={item.width}
            placements={item.placements}
            colorMap={colorMap}
          />
        )}

        {item.previews.length > 0 && (
          <div className="flex gap-2 mt-2">
            {item.previews.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized static PNG, see the mainUrl note above.
              <img
                key={p.url}
                src={p.url}
                alt="Mosaic preview"
                width={p.width}
                height={p.height}
                loading="lazy"
                className="w-14 h-14 rounded-lg border border-border-custom object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-text">LEGO Mosaic</h2>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent bg-accent/10 px-2.5 py-1 rounded-full shrink-0">
            Custom design
          </span>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted mt-3">
          <span className="inline-flex items-center gap-1.5">
            <GridIcon /> {item.width} × {item.height} studs
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PiecesIcon /> {item.totalParts.toLocaleString("en-US")} parts
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon /> {estimateBuildTime(item.totalParts)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <GaugeIcon /> {estimateDifficulty(item.totalParts)}
          </span>
        </div>

        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-highlight mt-3 w-fit">
          <CheckCircleIcon /> Ready to build
        </span>

        <div className="mt-auto pt-4 flex items-center justify-between">
          <button
            onClick={() => onRemove(item.artworkId)}
            disabled={removing}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-accent transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <TrashIcon /> {removing ? "Removing…" : "Remove"}
          </button>
          <span className="text-lg font-bold text-text">{priceLabel}</span>
        </div>
      </div>
    </div>
  );
});

function ArrowLeftIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0 6 6m-6-6 6-6" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x={3} y={3} width={7} height={7} rx={1} />
      <rect x={14} y={3} width={7} height={7} rx={1} />
      <rect x={3} y={14} width={7} height={7} rx={1} />
      <rect x={14} y={14} width={7} height={7} rx={1} />
    </svg>
  );
}

function PiecesIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 12 9 4.5 9-4.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="m3 16.5 9 4.5 9-4.5" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20V14M12 20V9M20 20V4" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx={12} cy={12} r={9} />
      <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 12.5 2.5 2.5 5-5" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-8 0 1 13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l1-13"
      />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x={5} y={11} width={14} height={9} rx={2} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4l3 3v3h-7z" />
      <circle cx={7.5} cy={18} r={1.6} />
      <circle cx={17.5} cy={18} r={1.6} />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x={4} y={4} width={16} height={16} rx={1} />
      <rect x={7.5} y={7.5} width={9} height={9} rx={0.5} />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x={3} y={9} width={18} height={11} rx={1} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9h18M12 9v11M12 9C9 9 8 6.5 9 5c1-1.5 3 0 3 4Zm0 0c3 0 4-2.5 3-4-1-1.5-3 0-3 4Z"
      />
    </svg>
  );
}
