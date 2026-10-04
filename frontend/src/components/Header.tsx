"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { federatedLogout } from "@/lib/logout";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
];

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="bg-accent grid grid-cols-2 shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.29,
        gap: size * 0.14,
        padding: size * 0.21,
      }}
    >
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="rounded-full bg-on-accent" />
      ))}
    </span>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const { data: session } = useSession();
  const user = session?.user;
  const loginHref = `/login${pathname && pathname !== "/" && pathname !== "/login" ? `?callbackUrl=${encodeURIComponent(pathname)}` : ""}`;

  useEffect(() => {
    let cancelled = false;

    const loadCount = () => {
      fetch("/api/cart/count")
        .then((res) => (res.ok ? res.json() : { count: 0 }))
        .then((data) => {
          if (!cancelled) setCartCount(data.count ?? 0);
        })
        .catch(() => {});
    };

    loadCount();
    window.addEventListener("cart:updated", loadCount);
    return () => {
      cancelled = true;
      window.removeEventListener("cart:updated", loadCount);
    };
  }, [pathname]);

  const handleNav = (href: string) => {
    setOpen(false);

    if (href.startsWith("/#")) {
      const id = href.slice(2);
      if (pathname === "/") {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      } else {
        window.location.href = href;
      }
    }
  };

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : !href.includes("#") && pathname.startsWith(href);

  const pill = (active: boolean) =>
    `px-4 py-2 rounded-full text-sm font-medium transition-colors ${
      active ? "bg-surface text-ink shadow-sm" : "text-ink-2 hover:text-ink"
    }`;

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-[60px] md:h-[72px] bg-glass backdrop-blur-[18px] backdrop-saturate-[1.4] border-b border-line">
      <div className="h-full flex items-center justify-between gap-6 pl-5 pr-4 md:px-12">
        <Link href="/" className="flex items-center gap-2 md:gap-2.5 text-ink">
          <LogoMark size={28} />
          <span className="font-display text-2xl md:text-[27px] leading-none tracking-tight">
            BrickArt
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex gap-1.5 p-1 rounded-full bg-surface-2 border border-line">
          {NAV.map((item) =>
            item.href.startsWith("/#") ? (
              <button
                key={item.label}
                onClick={() => handleNav(item.href)}
                className={pill(false)}
              >
                {item.label}
              </button>
            ) : (
              <Link key={item.label} href={item.href} className={pill(isActive(item.href))}>
                {item.label}
              </Link>
            )
          )}
        </nav>

        <div className="flex items-center gap-1 md:gap-2">
          <Link
            href="/cart"
            aria-label="View cart"
            className="relative w-11 h-11 rounded-full grid place-items-center text-ink hover:bg-surface-2 transition-colors"
          >
            <CartIcon />
            {cartCount > 0 && (
              <span className="absolute top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-on-accent text-[10px] font-bold grid place-items-center leading-none border-2 border-bg box-content">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          <div className="hidden md:flex items-center gap-2">
            {user ? (
              <AccountMenu name={user.name} email={user.email} />
            ) : (
              <>
                <Link
                  href={loginHref}
                  className="h-11 px-4 flex items-center rounded-full text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/create"
                  className="h-10 px-[18px] flex items-center gap-2 rounded-full bg-ink text-bg text-sm font-semibold hover:-translate-y-px transition-transform"
                >
                  Get started
                  <ArrowIcon />
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setOpen(!open)}
            className="md:hidden w-11 h-11 grid place-items-center text-ink"
            aria-label="Menu"
            aria-expanded={open}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
              {open ? (
                <path d="M6 6l12 12M18 6 6 18" />
              ) : (
                <>
                  <path d="M4 8h16" />
                  <path d="M4 16h16" />
                </>
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-b border-line bg-bg shadow-md">
          <nav className="flex flex-col px-4 py-3 gap-1">
            {NAV.map((item) =>
              item.href.startsWith("/#") ? (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.href)}
                  className="text-left px-4 py-3 rounded-2xl text-sm font-medium text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-2xl text-sm font-medium text-ink-2 hover:text-ink hover:bg-surface-2 transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
            <hr className="border-line my-2" />
            {user ? (
              <>
                <p className="px-4 py-2 text-sm text-ink-2 truncate">{user.email ?? user.name}</p>
                <button
                  onClick={() => void federatedLogout()}
                  className="text-left px-4 py-3 rounded-2xl text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  href={loginHref}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-2xl text-sm font-medium text-ink hover:bg-surface-2 transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/create"
                  onClick={() => setOpen(false)}
                  className="h-12 flex items-center justify-center rounded-full bg-ink text-bg text-sm font-semibold"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

/** Avatar button with a small menu: who's signed in, their cart, log out. */
function AccountMenu({ name, email }: { name?: string | null; email?: string | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const initial = (name || email || "?").trim()[0]?.toUpperCase() ?? "?";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        className="w-10 h-10 rounded-full bg-accent-soft text-accent-ink text-sm font-semibold grid place-items-center hover:bg-accent hover:text-on-accent transition-colors"
      >
        {initial}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-2xl bg-surface border border-line shadow-lg p-2"
        >
          <div className="px-3 py-2.5 border-b border-line mb-1">
            {name && <p className="text-sm font-semibold truncate">{name}</p>}
            {email && <p className="text-[13px] text-ink-2 truncate">{email}</p>}
          </div>
          <Link
            href="/cart"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-3 py-2.5 rounded-xl text-sm hover:bg-surface-2 transition-colors"
          >
            Your cart
          </Link>
          <button
            role="menuitem"
            onClick={() => void federatedLogout()}
            className="w-full text-left px-3 py-2.5 rounded-xl text-sm hover:bg-surface-2 transition-colors"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
