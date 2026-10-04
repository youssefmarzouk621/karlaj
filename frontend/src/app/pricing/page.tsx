/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getHomeImages } from "@/lib/siteImages";
import { sizeCm } from "@/lib/studs";

// Prices come from the dashboard (sizes + extra charges), so render per request.
export const dynamic = "force-dynamic";

const INCLUDED = [
  { title: "Mixed brick sizes", text: "Fewer pieces, faster builds, crisper edges." },
  { title: "Numbered bags", text: "One bag per section, built in order." },
  { title: "Booklet + PDF", text: "Step-by-step instructions, plus a download." },
  { title: "Premium Frame Kit", text: "Matching wood frame, included." },
];

export default async function PricingPage() {
  const [sizes, charges, img] = await Promise.all([
    prisma.mosaicSize.findMany({ orderBy: { sortOrder: "asc" } }).catch(() => []),
    prisma.extraCharge
      .findMany({ where: { enabled: true }, orderBy: { sortOrder: "asc" } })
      .catch(() => []),
    getHomeImages(),
  ]);

  const maxDim = Math.max(1, ...sizes.flatMap((s) => [s.width, s.height]));
  const art = img.sizes_art;

  return (
    <main className="flex-1 w-full max-w-[1312px] mx-auto px-4 md:px-8 pt-12 md:pt-20 pb-24 flex flex-col gap-14">
      <div className="grid lg:grid-cols-[7fr_5fr] gap-8 lg:gap-12 items-end">
        <div className="flex flex-col gap-4">
          <span className="text-xs tracking-[.14em] uppercase font-semibold text-accent-ink">Pricing</span>
          <h1 className="font-display font-normal text-[3rem] md:text-[4.5rem] leading-[.98] tracking-[-0.035em]">
            Priced by size.
            <br />
            <em className="text-ink-2">Everything included.</em>
          </h1>
        </div>
        <p className="text-lg leading-relaxed text-ink-2">
          One price per size covers the bricks, numbered bags, instruction booklet, PDF and the
          premium frame kit.
          {charges.length > 0 && (
            <>
              {" "}
              Added at checkout:{" "}
              {charges
                .map((c) => `${c.name} ${c.displayPrice || `${c.price / 1000} TND`}`)
                .join(", ")}
              .
            </>
          )}
        </p>
      </div>

      {sizes.length === 0 ? (
        <p className="rounded-3xl bg-surface border border-line p-10 text-center text-ink-2">
          Pricing is being updated — check back shortly.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {sizes.map((s) => {
            const label = `${s.width} × ${s.height}`;
            return (
              <div
                key={s.id}
                data-testid="price-card"
                className={`rounded-[28px] bg-surface border border-line p-7 flex flex-col gap-6 transition-all duration-300 ${
                  s.enabled ? "hover:-translate-y-1 hover:shadow-lg" : "opacity-60"
                }`}
              >
                <div className="flex justify-between items-start min-h-[120px]">
                  <div className="flex flex-col gap-1.5">
                    <h2 className="font-display font-normal text-[2.75rem] leading-none tracking-[-0.02em]">
                      {label}
                    </h2>
                    <span className="text-sm text-ink-2">{sizeCm(s.width, s.height)}</span>
                    {!s.enabled && (
                      <span className="self-start mt-2 px-2.5 py-1 rounded-full bg-surface-2 text-xs font-semibold">
                        Coming soon
                      </span>
                    )}
                  </div>
                  {/* The artwork drawn at this size's proportions. */}
                  <div className="w-[120px] h-[120px] flex items-end justify-end">
                    <img
                      src={art.src}
                      alt=""
                      className="object-cover rounded-[3px] shadow-md"
                      style={{
                        width: `${(s.width / maxDim) * 120}px`,
                        height: `${(s.height / maxDim) * 120}px`,
                      }}
                    />
                  </div>
                </div>

                <div className="text-[2.5rem] font-semibold tracking-[-0.02em] leading-none">
                  {s.displayPrice || <span className="text-xl text-ink-2 font-medium">Pricing soon</span>}
                </div>

                <ul className="pt-4 border-t border-line flex flex-col gap-2.5 text-sm">
                  <li className="flex justify-between">
                    <span className="text-ink-2">Finished size</span>
                    <span className="font-semibold">{sizeCm(s.width, s.height)}</span>
                  </li>
                  <li className="flex justify-between">
                    <span className="text-ink-2">Studs</span>
                    <span className="font-semibold">{(s.width * s.height).toLocaleString("en-US")}</span>
                  </li>
                </ul>

                {s.enabled ? (
                  <Link
                    href={`/create?size=${s.width}x${s.height}`}
                    className="h-[52px] rounded-full bg-surface-2 hover:bg-ink hover:text-bg text-ink font-semibold text-[15px] flex items-center justify-center transition-colors"
                  >
                    Start with {label}
                  </Link>
                ) : (
                  <span
                    aria-disabled="true"
                    className="h-[52px] rounded-full bg-surface-2 text-ink-3 font-semibold text-[15px] flex items-center justify-center cursor-not-allowed"
                  >
                    Not available yet
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-[28px] bg-surface border border-line p-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
        {INCLUDED.map((i) => (
          <div key={i.title} className="flex flex-col gap-2">
            <span className="text-base font-semibold">{i.title}</span>
            <span className="text-sm leading-normal text-ink-2">{i.text}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
