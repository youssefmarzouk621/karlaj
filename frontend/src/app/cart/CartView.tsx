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
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-20 flex flex-col items-center justify-center gap-5 text-center">
        <div className="grid grid-cols-4 gap-1.5" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <span key={i} className={`w-[22px] h-[22px] rounded-full ${i === 2 ? "bg-accent" : "bg-surface-2"}`} />
          ))}
        </div>
        <h1 className="font-display font-normal text-5xl leading-none tracking-[-0.02em]">
          Your cart is empty
        </h1>
        <p className="text-base leading-relaxed text-ink-2 max-w-[420px] text-balance">
          Generate a mosaic and add it to your cart to see it here.
        </p>
        <Link
          href="/create"
          className="h-[52px] px-[26px] rounded-full bg-accent hover:bg-accent-hover text-on-accent font-semibold text-[15px] inline-flex items-center transition-colors"
        >
          Create a mosaic
        </Link>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 md:px-8 pt-8 md:pt-12 pb-24 flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <Link
          href="/create"
          className="self-start inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink transition-colors"
        >
          <ArrowLeftIcon /> Continue shopping
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="font-display font-normal text-6xl md:text-7xl leading-none tracking-[-0.03em]">
            Your cart
          </h1>
          <span className="text-base text-ink-2">
            {items.length} {items.length === 1 ? "mosaic" : "mosaics"} ready to build
          </span>
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-danger-soft text-danger text-sm px-4 py-3">
          {error}
        </p>
      )}

      <div className="grid lg:grid-cols-[minmax(0,1fr)_400px] gap-8 items-start">
        {/* Items */}
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-5">
            {items.map((item) => (
              <CartItemCard
                key={item.artworkId}
                item={item}
                removing={removingId === item.artworkId}
                onRemove={handleRemove}
              />
            ))}
          </div>

          {/* Upsells */}
          <section className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">What comes with the package</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {ADDONS.map((addon) => (
                <div
                  key={addon.name}
                  className="rounded-3xl border border-line bg-surface p-6 flex gap-4"
                >
                  <span className="w-12 h-12 shrink-0 rounded-[14px] bg-surface-2 grid place-items-center text-ink">
                    {addon.icon}
                  </span>
                  <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                    <h3 className="font-semibold">{addon.name}</h3>
                    <p className="text-sm leading-normal text-ink-2">{addon.description}</p>
                    {addon.included ? (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success mt-1">
                        <CheckIcon /> Included
                      </span>
                    ) : (
                      <div className="flex items-center justify-between mt-1">
                        <span className="font-semibold">+{formatPrice(addon.price!)}</span>
                        <button
                          onClick={() => showPreviewNotice(addon.name)}
                          className="h-10 px-4 rounded-full border border-line-strong bg-surface text-sm font-medium inline-flex items-center gap-1.5 hover:bg-ink hover:text-bg transition-colors"
                        >
                          <PlusIcon /> Add
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Order summary */}
        <aside className="rounded-[28px] border border-line bg-surface shadow-md p-7 lg:sticky lg:top-24 flex flex-col gap-5">
          <h2 className="font-display font-normal text-4xl leading-none tracking-[-0.015em]">
            Order summary
          </h2>

          <div className="flex flex-col gap-3 text-[15px]">
            <div className="flex justify-between">
              <span className="text-ink-2">
                Subtotal ({items.length} {items.length === 1 ? "item" : "items"})
              </span>
              <span className="font-medium" data-testid="cart-subtotal">
                {formatMillimes(totals.subtotal)}
              </span>
            </div>
            {charges.map((c) => (
              <div key={c.id} className="flex justify-between" data-testid="cart-charge">
                <span className="text-ink-2">{c.name}</span>
                <span className="font-medium">{c.displayPrice || formatMillimes(c.price)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between pt-4 border-t border-line">
            <span className="text-base font-semibold">Total</span>
            <span className="text-4xl font-semibold tracking-[-0.02em]" data-testid="cart-total">
              {formatMillimes(totals.total)}
            </span>
          </div>

          <button
            onClick={() => showPreviewNotice("Checkout")}
            className="h-[60px] rounded-full bg-accent hover:bg-accent-hover text-on-accent font-semibold text-[17px] flex items-center justify-center gap-2.5 shadow-[0_10px_24px_-10px_rgba(194,64,30,.7)] transition-all hover:-translate-y-px active:scale-[.98]"
          >
            <LockIcon /> Proceed to checkout
          </button>

          {notice && (
            <p role="status" className="text-[13px] text-center text-ink-2">
              {notice}
            </p>
          )}

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => showPreviewNotice("Google Pay")}
              className="h-12 rounded-full border border-line-strong bg-surface text-[15px] font-semibold hover:bg-surface-2 transition-colors"
            >
              Google Pay
            </button>
            <button
              onClick={() => showPreviewNotice("Apple Pay")}
              className="h-12 rounded-full bg-ink text-bg text-[15px] font-semibold hover:opacity-90 transition-opacity"
            >
              Apple Pay
            </button>
          </div>

          <ul className="pt-4 border-t border-line flex flex-col gap-3.5">
            {[
              { icon: <LockIcon />, title: "Secure checkout", text: "Your details stay encrypted end to end." },
              { icon: <TruckIcon />, title: "Fast, reliable delivery", text: "Bricks and instructions shipped together." },
              { icon: <ShieldIcon />, title: "Satisfaction guaranteed", text: "Missing a piece? We'll ship a replacement." },
            ].map((t) => (
              <li key={t.title} className="flex gap-3">
                <span className="mt-0.5 shrink-0 text-ink">{t.icon}</span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">{t.title}</span>
                  <span className="text-[13px] text-ink-2">{t.text}</span>
                </span>
              </li>
            ))}
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
    <article className="rounded-[28px] border border-line bg-surface p-5 grid sm:grid-cols-[260px_minmax(0,1fr)] gap-5 sm:gap-7">
      <div className="flex flex-col gap-2.5">
        {/* The mosaic, framed like a print on a gallery wall. */}
        <div className="rounded-[18px] bg-gradient-to-b from-[#E6E2DB] to-[#D6D1C9] aspect-square grid place-items-center p-4">
          <div className="bg-[#1B1916] p-1.5 shadow-art max-w-full">
            <div className="bg-[#FBFAF8] p-3.5">
              {item.mainUrl ? (
                // Pre-sized static PNG rendered at creation time; next/image's
                // on-request optimization pipeline would add nothing here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.mainUrl}
                  alt="LEGO mosaic"
                  width={item.mainWidth ?? undefined}
                  height={item.mainHeight ?? undefined}
                  loading="lazy"
                  className="block h-auto max-h-[170px] w-auto max-w-full"
                />
              ) : (
                <div className="w-[150px]">
                  <MosaicPreview
                    gridRows={item.height}
                    gridCols={item.width}
                    placements={item.placements}
                    colorMap={colorMap}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {item.previews.length > 0 && (
          <div className="grid grid-cols-2 gap-2.5">
            {item.previews.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- pre-sized static PNG, see the mainUrl note above.
              <img
                key={p.url}
                src={p.url}
                alt="Mosaic preview"
                width={p.width}
                height={p.height}
                loading="lazy"
                className="w-full aspect-[1.4] rounded-[8px] border border-line object-cover"
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[18px] min-w-0 sm:py-2 sm:pr-2">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h2 className="font-display font-normal text-4xl leading-none tracking-[-0.015em]">
              LEGO Mosaic
            </h2>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <CheckIcon /> Ready to build
            </span>
          </div>
          <span className="shrink-0 px-2.5 py-1 rounded-full bg-accent-soft text-accent-ink text-xs font-semibold">
            Custom design
          </span>
        </div>

        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-2xl bg-bg">
          {[
            ["Size (studs)", `${item.width} × ${item.height}`],
            ["Parts", item.totalParts.toLocaleString("en-US")],
            ["Build time", estimateBuildTime(item.totalParts)],
            ["Level", estimateDifficulty(item.totalParts)],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-xs text-ink-2">{label}</dt>
              <dd className="m-0 text-[15px] font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-auto flex items-center justify-between">
          <button
            onClick={() => onRemove(item.artworkId)}
            disabled={removing}
            className="-ml-3.5 h-11 px-3.5 rounded-full inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:bg-danger-soft hover:text-danger transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <TrashIcon /> {removing ? "Removing…" : "Remove"}
          </button>
          <span className="text-[28px] font-semibold">{priceLabel}</span>
        </div>
      </div>
    </article>
  );
});

function ArrowLeftIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5m0 0 6 6m-6-6 6-6" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
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
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <rect x={5} y={11} width={14} height={9} rx={2} />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

function TruckIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v9H3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 10h4l3 3v3h-7z" />
      <circle cx={7.5} cy={18} r={1.6} />
      <circle cx={17.5} cy={18} r={1.6} />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg className="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" />
    </svg>
  );
}

function FrameIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x={4} y={4} width={16} height={16} rx={1} />
      <rect x={7.5} y={7.5} width={9} height={9} rx={0.5} />
    </svg>
  );
}

function GiftIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x={3} y={9} width={18} height={11} rx={1} />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 9h18M12 9v11M12 9C9 9 8 6.5 9 5c1-1.5 3 0 3 4Zm0 0c3 0 4-2.5 3-4-1-1.5-3 0-3 4Z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}
