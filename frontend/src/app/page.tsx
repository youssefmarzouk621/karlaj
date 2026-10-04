/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import ScrollReveal from "@/components/ScrollReveal";
import HeroScene from "@/components/home/HeroScene";
import CompareSlider from "@/components/home/CompareSlider";
import { getHomeImages } from "@/lib/siteImages";

// Homepage images come from the dashboard (site_images), so render per request.
export const dynamic = "force-dynamic";

const QUOTES = [
  { text: "It looks like a print until you get close. Then you see every brick.", name: "Amira B.", meta: "64 × 64 · Tunis" },
  { text: "The numbered bags made a 4,000-piece build feel easy. Two weekends, done.", name: "Youssef K.", meta: "48 × 48 · Sousse" },
  { text: "Gave it as a gift. The room preview sold me before I ordered.", name: "Lina M.", meta: "32 × 32 · Sfax" },
];

const SIZES = [
  { label: "16 × 16", meta: "256 studs · 12.8 cm", px: 64, border: 4 },
  { label: "48 × 48", meta: "2,304 studs · 38.4 cm", px: 192, border: 6 },
  { label: "96 × 96", meta: "9,216 studs · 76.8 cm", px: 300, border: 8 },
];

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <span className="text-xs tracking-[.14em] uppercase font-semibold text-accent-ink">{children}</span>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="font-display font-normal text-[2.75rem] md:text-[4rem] leading-none tracking-[-0.025em]">
    {children}
  </h2>
);

function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

export default async function Home() {
  const img = await getHomeImages();
  const gallery = [1, 2, 3, 4].map((n) => img[`gallery_${n}`]);

  return (
    <main className="flex-1 flex flex-col">
      {/* ─── HERO ─── */}
      <section className="px-5 md:px-16 pt-10 md:pt-[72px] pb-16 md:pb-24 grid lg:grid-cols-[5fr_7fr] gap-10 lg:gap-14 items-center">
        <div className="flex flex-col gap-8 order-2 lg:order-1">
          <span className="inline-flex self-start items-center gap-2 py-1.5 pl-1.5 pr-3 rounded-full bg-surface border border-line text-[13px] text-ink-2">
            <span className="px-2 py-[3px] rounded-full bg-accent-soft text-accent-ink font-semibold text-xs">New</span>
            Room previews for every mosaic
          </span>
          <h1 className="font-display font-normal text-[clamp(3.25rem,6.2vw,5.5rem)] leading-[.95] tracking-[-0.04em]">
            Your photo.
            <br />
            <em className="text-accent">In bricks.</em>
          </h1>
          <p className="text-lg md:text-xl leading-relaxed text-ink-2 max-w-[460px] text-pretty">
            Upload any image and get a real, buildable LEGO mosaic kit — mixed brick sizes,
            numbered bags, and a step-by-step instruction booklet.
          </p>
          <div className="flex gap-3 flex-wrap">
            <Link
              href="/create"
              className="h-14 px-7 rounded-full bg-accent hover:bg-accent-hover text-on-accent font-semibold inline-flex items-center gap-2.5 shadow-[0_8px_20px_-8px_rgba(194,64,30,.6)] hover:-translate-y-px transition-all"
            >
              Start building
              <Arrow />
            </Link>
            <a
              href="#how"
              className="h-14 px-6 rounded-full border border-line-strong bg-surface hover:bg-surface-2 text-ink font-medium inline-flex items-center transition-colors"
            >
              How it works
            </a>
          </div>
        </div>
        <div className="order-1 lg:order-2">
          <HeroScene />
        </div>
      </section>

      {/* ─── BEFORE & AFTER ─── */}
      <section className="px-5 md:px-16 pb-24 md:pb-[120px] grid lg:grid-cols-[5fr_7fr] gap-10 lg:gap-14 items-center">
        <ScrollReveal className="flex flex-col gap-5">
          <Eyebrow>Before &amp; after</Eyebrow>
          <SectionTitle>From photo to brick masterpiece</SectionTitle>
          <p className="text-lg leading-relaxed text-ink-2 max-w-[440px]">
            See the magic of transformation from your photo to a LEGO® mosaic.
          </p>
        </ScrollReveal>
        <ScrollReveal>
          <CompareSlider
            before={img.compare_before.src}
            beforeAlt={img.compare_before.alt}
            after={img.compare_after.src}
            afterAlt={img.compare_after.alt}
          />
        </ScrollReveal>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="px-5 md:px-16 pb-24 md:pb-[120px] flex flex-col gap-12 scroll-mt-20">
        <ScrollReveal className="flex flex-col md:flex-row md:justify-between md:items-end gap-6 md:gap-8 border-t border-line pt-12">
          <div className="flex flex-col gap-4">
            <Eyebrow>How it works</Eyebrow>
            <SectionTitle>Three steps to the wall</SectionTitle>
          </div>
          <Link
            href="/create"
            className="self-start h-12 px-[22px] rounded-full bg-ink text-bg font-semibold text-[15px] inline-flex items-center gap-2 hover:-translate-y-px transition-transform"
          >
            Start building
          </Link>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-5">
          <ScrollReveal delay={0} className="h-full">
            <StepCard n="01" title="Upload a photo" body="Portraits, pets, logos, or landscapes all work. We center-crop it to your mosaic size.">
              <div className="h-24 rounded-2xl border-[1.5px] border-dashed border-line-strong bg-bg grid place-items-center text-ink-2">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12" />
                  <path d="m17 8-5-5-5 5" />
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                </svg>
              </div>
            </StepCard>
          </ScrollReveal>
          <ScrollReveal delay={100} className="h-full">
            <StepCard n="02" title="Pick a size" body="From 16 × 16 for a desk to 96 × 96 for a wall, with the price and real dimensions upfront.">
              <div className="h-24 flex items-end gap-3">
                <span className="w-7 h-7 rounded bg-surface-2 border border-line-strong" />
                <span className="w-[52px] h-[52px] rounded-[5px] bg-surface-2 border border-line-strong" />
                <span
                  className="w-24 h-24 rounded-md shadow-md bg-cover bg-center"
                  style={{ backgroundImage: `url(${img.sizes_art.src})` }}
                />
              </div>
            </StepCard>
          </ScrollReveal>
          <ScrollReveal delay={200} className="h-full">
            <StepCard n="03" title="Get your kit" body="Mixed brick sizes, numbered bags, a printed booklet and a downloadable PDF.">
              <div className="h-24 flex items-end gap-2">
                <span className="w-[68px] h-[92px] rounded-md bg-ink text-bg text-[10px] font-semibold p-2 flex items-end">Booklet</span>
                {[1, 2, 3].map((n) => (
                  <span key={n} className="w-10 h-[52px] rounded-lg bg-surface-2 border border-line-strong grid place-items-center text-xs font-bold">
                    {n}
                  </span>
                ))}
              </div>
            </StepCard>
          </ScrollReveal>
        </div>
      </section>

      {/* ─── 3D PREVIEW / FEATURES ─── */}
      <section id="features" className="mx-5 md:mx-16 mb-24 md:mb-[120px] rounded-[32px] bg-[#151413] text-[#F2EEE7] grid lg:grid-cols-[5fr_7fr] overflow-hidden min-h-[560px] scroll-mt-20">
        <div className="p-8 md:p-16 flex flex-col gap-5 justify-center">
          <span className="text-xs tracking-[.14em] uppercase font-semibold text-[#F08A66]">3D preview</span>
          <h2 className="font-display font-normal text-[2.5rem] md:text-[3.5rem] leading-none tracking-[-0.025em]">
            See your LEGO® mosaic come to life
          </h2>
          <p className="text-[17px] leading-relaxed text-[#A9A399] max-w-[400px]">
            Explore your design in 3D and adjust the view from every angle.
          </p>
        </div>
        <div className="relative min-h-[360px] [perspective:1400px] grid place-items-center overflow-hidden bg-[radial-gradient(circle_at_60%_40%,#2A2826,#151413_70%)]">
          <img
            src={img.preview_3d.src}
            alt={img.preview_3d.alt}
            className="w-[min(440px,70vw)] aspect-square [transform:rotateX(52deg)_rotateZ(-30deg)] shadow-[30px_60px_60px_rgba(0,0,0,.6)]"
          />
          <span className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3.5 py-2 rounded-full bg-white/10 backdrop-blur-[10px] border border-white/10 text-[13px] whitespace-nowrap">
            Real BrickLink colors · mixed brick sizes
          </span>
        </div>
      </section>

      {/* ─── GALLERY ─── */}
      <section className="px-5 md:px-16 pb-24 md:pb-[120px] flex flex-col gap-12">
        <ScrollReveal className="flex flex-col gap-4 border-t border-line pt-12">
          <Eyebrow>Gallery</Eyebrow>
          <SectionTitle>Built with BrickArt</SectionTitle>
          <p className="text-lg leading-relaxed text-ink-2">
            Every image becomes a unique mosaic. Here are some of our favorites.
          </p>
        </ScrollReveal>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          {gallery.map((g, i) => (
            <ScrollReveal key={i} delay={i * 80}>
              <div className="rounded-3xl bg-surface border border-line p-3 flex flex-col gap-3.5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
                <img src={g.src} alt={g.alt} className="w-full aspect-square object-cover rounded-[14px] block" />
                <div className="px-2 pb-2 flex flex-col gap-0.5">
                  <span className="text-base font-semibold">{g.title}</span>
                  <span className="text-[13px] text-ink-2">{g.meta}</span>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* ─── SIZES ─── */}
      <section className="px-5 md:px-16 pb-24 md:pb-[120px] flex flex-col gap-12">
        <ScrollReveal className="flex flex-col gap-4 border-t border-line pt-12">
          <Eyebrow>Sizes</Eyebrow>
          <SectionTitle>From desk to wall</SectionTitle>
        </ScrollReveal>
        <div className="relative rounded-[32px] bg-gradient-to-b from-[#E6E2DB] to-[#D9D5CE] overflow-hidden flex items-end justify-center gap-6 md:gap-[72px] pt-16 pb-24 md:pb-[120px] text-[#1B1916]">
          <div className="absolute inset-x-0 bottom-0 h-16 md:h-24 bg-[#C8C3BB] border-t border-[#B9B4AC]" />
          {SIZES.map((s) => (
            <div key={s.label} className="relative flex flex-col items-center gap-3.5">
              <img
                src={img.sizes_art.src}
                alt={`${img.sizes_art.alt} at ${s.label}`}
                className="shadow-art border-[#1B1916] max-w-[26vw] h-auto"
                style={{ width: s.px, height: s.px, borderWidth: s.border, borderStyle: "solid" }}
              />
              <span className="text-center text-sm font-semibold">
                {s.label}
                <br />
                <span className="font-normal text-[#5C564E] text-[13px]">{s.meta}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── QUOTES ─── */}
      <section className="px-5 md:px-16 pb-24 md:pb-[120px] grid md:grid-cols-3 gap-5">
        {QUOTES.map((q, i) => (
          <ScrollReveal key={q.name} delay={i * 100} className="h-full">
            <figure className="m-0 h-full rounded-3xl bg-surface border border-line p-8 flex flex-col gap-6">
              <blockquote className="m-0 font-display text-[1.75rem] leading-[1.2] tracking-[-0.01em]">
                “{q.text}”
              </blockquote>
              <figcaption className="flex items-center gap-3 mt-auto">
                <span aria-hidden className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent-ink grid place-items-center text-sm font-semibold">{q.name[0]}</span>
                <span className="flex flex-col">
                  <span className="text-sm font-semibold">{q.name}</span>
                  <span className="text-[13px] text-ink-2">{q.meta}</span>
                </span>
              </figcaption>
            </figure>
          </ScrollReveal>
        ))}
      </section>

      {/* ─── CTA ─── */}
      <section className="mx-5 md:mx-16 mb-16 md:mb-24 rounded-[32px] bg-ink text-bg px-8 py-14 md:px-16 md:py-20 flex flex-col md:flex-row md:justify-between md:items-end gap-8 md:gap-12">
        <h2 className="font-display font-normal text-[2.75rem] md:text-[4.25rem] leading-[.98] tracking-[-0.035em] max-w-[820px]">
          Turn your favorite photo into <em>wall art.</em>
        </h2>
        <Link
          href="/create"
          className="self-start md:self-auto h-14 px-7 rounded-full bg-accent hover:bg-accent-hover text-on-accent font-semibold inline-flex items-center gap-2.5 shrink-0 transition-colors"
        >
          Start building
          <Arrow />
        </Link>
      </section>
    </main>
  );
}

function StepCard({
  n,
  title,
  body,
  children,
}: {
  n: string;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <div className="h-full min-h-[280px] rounded-3xl bg-surface border border-line p-8 flex flex-col gap-5 hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
      <span className="font-display text-[3.5rem] leading-none text-accent">{n}</span>
      {children}
      <div className="flex flex-col gap-1.5 mt-auto">
        <span className="text-xl font-semibold">{title}</span>
        <span className="text-[15px] leading-relaxed text-ink-2">{body}</span>
      </div>
    </div>
  );
}
