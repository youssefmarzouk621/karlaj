import Link from "next/link";
import { LogoMark } from "./Header";

const LINKS = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
  { label: "Create", href: "/create" },
  { label: "Cart", href: "/cart" },
];

export default function Footer() {
  return (
    <footer className="border-t border-line px-5 md:px-16 pt-8 md:pt-12 pb-10 md:pb-14 flex flex-wrap gap-8 justify-between items-start text-sm text-ink-2">
      <div className="flex flex-col gap-3 max-w-xs">
        <span className="flex items-center gap-2.5 text-ink">
          <LogoMark size={24} />
          <span className="font-display text-2xl leading-none">BrickArt</span>
        </span>
        <span className="leading-normal">
          LEGO® is a trademark of the LEGO Group, which does not sponsor,
          authorize or endorse this site.
        </span>
      </div>
      <nav className="flex flex-wrap gap-x-7 gap-y-2">
        {LINKS.map((l) => (
          <Link key={l.label} href={l.href} className="py-1.5 hover:text-ink transition-colors">
            {l.label}
          </Link>
        ))}
      </nav>
      <span className="py-1.5">© {new Date().getFullYear()} BrickArt</span>
    </footer>
  );
}
