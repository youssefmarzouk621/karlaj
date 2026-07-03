"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";

const LegoScene = dynamic(() => import("@/components/LegoScene"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-surface rounded-2xl flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

const EXAMPLES = [
  {
    title: "Golden Hour Portrait",
    size: "48 x 48",
    pieces: 412,
    colors: [
      ["#C4533A", "#E8A84C", "#F5F0EB", "#D49A6A"],
      ["#B45429", "#C08060", "#8A8580", "#E0C0A0"],
      ["#5C3D2E", "#E8A84C", "#C4533A", "#F5F0EB"],
      ["#D49A6A", "#B45429", "#8A8580", "#C08060"],
    ],
  },
  {
    title: "City Skyline",
    size: "64 x 32",
    pieces: 587,
    colors: [
      ["#1A1A1A", "#2A2A2A", "#3A3A3A", "#8A8580", "#8A8580", "#3A3A3A"],
      ["#1A1A1A", "#3A3A3A", "#1A1A1A", "#2A2A2A", "#F5F0EB", "#2A2A2A"],
      ["#2A2A2A", "#1A1A1A", "#3A3A3A", "#1A1A1A", "#2A2A2A", "#1A1A1A"],
      ["#C4533A", "#C4533A", "#B45429", "#B45429", "#C4533A", "#C4533A"],
    ],
  },
  {
    title: "Family Pet",
    size: "32 x 32",
    pieces: 234,
    colors: [
      ["#E0C0A0", "#D49A6A", "#C08060", "#E0C0A0"],
      ["#D49A6A", "#5C3D2E", "#5C3D2E", "#D49A6A"],
      ["#C08060", "#4A3228", "#5C3D2E", "#C08060"],
      ["#E0C0A0", "#D49A6A", "#C08060", "#E0C0A0"],
    ],
  },
  {
    title: "Abstract Wave",
    size: "96 x 48",
    pieces: 1283,
    colors: [
      ["#C4533A", "#D4634A", "#E8A84C", "#D4634A", "#C4533A"],
      ["#B45429", "#C4533A", "#D4634A", "#E8A84C", "#D4634A"],
      ["#5C3D2E", "#B45429", "#C4533A", "#D4634A", "#E8A84C"],
      ["#322018", "#5C3D2E", "#B45429", "#C4533A", "#D4634A"],
    ],
  },
];

function MiniMosaic({ colors }: { colors: string[][] }) {
  const rows = colors.length;
  const cols = colors[0].length;
  return (
    <div
      className="w-full aspect-square rounded-lg overflow-hidden"
      style={{
        display: "grid",
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "2px",
      }}
    >
      {colors.flat().map((color, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <main className="flex-1 flex flex-col">
      {/* ─── HERO ─── */}
      <section className="min-h-screen flex items-center px-6 md:px-12 lg:px-20">
        <div className="max-w-7xl mx-auto w-full grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div className="order-2 md:order-1">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
              Your photo.
              <br />
              <span className="text-accent">In bricks.</span>
            </h1>
            <p className="mt-6 text-muted text-lg md:text-xl max-w-md leading-relaxed">
              Upload any image and get a real, buildable LEGO mosaic kit —
              mixed brick sizes, numbered bags, and a step-by-step instruction
              booklet.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/create"
                className="bg-accent hover:bg-accent-hover active:scale-[0.97] text-white font-bold text-lg px-8 py-4 rounded-xl transition-all"
              >
                Start building
              </Link>
              <button
                onClick={() =>
                  document
                    .getElementById("how-it-works")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="text-muted hover:text-text border border-border-custom px-8 py-4 rounded-xl transition-colors font-medium"
              >
                How it works
              </button>
            </div>
          </div>
          <div className="order-1 md:order-2 h-[400px] md:h-[560px] rounded-2xl overflow-hidden border border-border-custom">
            <LegoScene />
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how-it-works" className="py-32 px-6 md:px-12">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-3">
              How it works
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Three steps to your kit
            </h2>
          </ScrollReveal>

          <div className="mt-16 grid md:grid-cols-3 gap-10">
            <ScrollReveal delay={0}>
              <div className="group">
                <div className="w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-xl font-black mb-5 group-hover:bg-accent group-hover:text-white transition-all duration-300">
                  01
                </div>
                <h3 className="text-lg font-bold mb-2">Upload your photo</h3>
                <p className="text-muted leading-relaxed text-sm">
                  Drop in any JPEG or PNG — portraits, landscapes, pets, logos.
                  We handle cropping and color mapping automatically.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={150}>
              <div className="group">
                <div className="w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-xl font-black mb-5 group-hover:bg-accent group-hover:text-white transition-all duration-300">
                  02
                </div>
                <h3 className="text-lg font-bold mb-2">Pick your size</h3>
                <p className="text-muted leading-relaxed text-sm">
                  From 16&times;16 up to 96&times;96 studs. Our engine maps
                  every pixel to one of 40+ real LEGO colors using perceptual
                  color science.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="group">
                <div className="w-14 h-14 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent text-xl font-black mb-5 group-hover:bg-accent group-hover:text-white transition-all duration-300">
                  03
                </div>
                <h3 className="text-lg font-bold mb-2">Get your LEGO kit</h3>
                <p className="text-muted leading-relaxed text-sm">
                  Numbered bags with mixed brick sizes and a full instruction
                  booklet with color-coded step grids — just like an official
                  LEGO set.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── EXAMPLES GALLERY ─── */}
      <section className="py-32 px-6 md:px-12 border-t border-border-custom">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <p className="text-highlight font-semibold text-sm tracking-widest uppercase mb-3">
              Gallery
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Built with BrickArt
            </h2>
            <p className="text-muted mt-3 text-lg max-w-lg">
              Every image becomes a unique mosaic. Here are some of our
              favorites.
            </p>
          </ScrollReveal>

          <div className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {EXAMPLES.map((ex, i) => (
              <ScrollReveal key={ex.title} delay={i * 100}>
                <div className="group bg-surface rounded-2xl border border-border-custom overflow-hidden hover:border-accent/30 transition-all duration-300">
                  <div className="p-5">
                    <MiniMosaic colors={ex.colors} />
                  </div>
                  <div className="px-5 pb-5">
                    <h3 className="font-bold text-sm">{ex.title}</h3>
                    <p className="text-muted text-xs mt-1">
                      {ex.size} &middot; {ex.pieces} pieces
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-32 px-6 md:px-12 bg-surface border-t border-border-custom scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <p className="text-accent font-semibold text-sm tracking-widest uppercase mb-3">
              Features
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Real engineering inside
            </h2>
          </ScrollReveal>

          <div className="mt-16 grid md:grid-cols-2 gap-5">
            <ScrollReveal delay={0}>
              <div className="bg-bg rounded-2xl p-7 border border-border-custom hover:border-accent/20 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent font-bold text-lg mb-4">
                  40+
                </div>
                <h3 className="font-bold mb-2">Authentic LEGO colors</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Real BrickLink color palette with Delta E 2000 perceptual
                  matching. Every pixel maps to a color you can actually
                  source.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={100}>
              <div className="bg-bg rounded-2xl p-7 border border-border-custom hover:border-accent/20 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-highlight/10 flex items-center justify-center text-highlight font-bold text-lg mb-4">
                  14
                </div>
                <h3 className="font-bold mb-2">Mixed brick types</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Not just 1&times;1 studs. Tiles, plates, and rounds from
                  1&times;1 to 2&times;4 — randomized and fitted like a real
                  set.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={200}>
              <div className="bg-bg rounded-2xl p-7 border border-border-custom hover:border-accent/20 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent mb-4">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>
                <h3 className="font-bold mb-2">Numbered bags</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Parts organized into bags by grid section. Open one bag at a
                  time and build section by section, just like the real thing.
                </p>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="bg-bg rounded-2xl p-7 border border-border-custom hover:border-accent/20 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-highlight/10 flex items-center justify-center text-highlight mb-4">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
                <h3 className="font-bold mb-2">Instruction booklet</h3>
                <p className="text-muted text-sm leading-relaxed">
                  Auto-generated PDF with cover, per-bag parts lists,
                  color-coded grids with accessibility symbols, and a finished
                  reference.
                </p>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── SIZES ─── */}
      <section className="py-32 px-6 md:px-12 border-t border-border-custom">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <p className="text-highlight font-semibold text-sm tracking-widest uppercase mb-3">
              Sizes
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              From desk to wall
            </h2>
          </ScrollReveal>

          <div className="mt-16 flex items-end justify-center gap-8 md:gap-14">
            <ScrollReveal delay={0}>
              <div className="flex flex-col items-center">
                <div className="w-14 h-14 md:w-16 md:h-16 rounded-lg border border-border-custom grid grid-cols-3 grid-rows-3 gap-[2px] p-1.5">
                  {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="bg-accent rounded-full" />
                  ))}
                </div>
                <span className="text-sm font-bold mt-3">16&times;16</span>
                <span className="text-xs text-muted">256 studs</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={150}>
              <div className="flex flex-col items-center">
                <div className="w-24 h-24 md:w-28 md:h-28 rounded-lg border border-border-custom grid grid-cols-5 grid-rows-5 gap-[2px] p-2">
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} className="bg-highlight rounded-full" />
                  ))}
                </div>
                <span className="text-sm font-bold mt-3">48&times;48</span>
                <span className="text-xs text-muted">2,304 studs</span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={300}>
              <div className="flex flex-col items-center">
                <div className="w-36 h-36 md:w-44 md:h-44 rounded-lg border border-border-custom grid grid-cols-7 grid-rows-7 gap-[2px] p-2.5">
                  {Array.from({ length: 49 }).map((_, i) => (
                    <div key={i} className="bg-accent rounded-full" />
                  ))}
                </div>
                <span className="text-sm font-bold mt-3">96&times;96</span>
                <span className="text-xs text-muted">9,216 studs</span>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-32 px-6 bg-accent">
        <div className="max-w-2xl mx-auto text-center">
          <ScrollReveal>
            <h2 className="text-4xl md:text-6xl font-black tracking-tight text-white">
              Ready to build?
            </h2>
            <p className="mt-4 text-white/70 text-lg">
              Turn your favorite photo into a LEGO masterpiece.
            </p>
            <Link
              href="/create"
              className="inline-block mt-8 bg-white text-accent hover:bg-text active:scale-[0.97] font-bold text-lg px-10 py-4 rounded-xl transition-all"
            >
              Create your mosaic
            </Link>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer className="py-8 px-6 border-t border-border-custom text-center text-muted text-sm">
        BrickArt — Photo to LEGO Mosaic Generator
      </footer>
    </main>
  );
}
