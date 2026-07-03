"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { label: "Home", href: "/" },
  { label: "Features", href: "/#features" },
  { label: "Pricing", href: "/pricing" },
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

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

  return (
    <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-bg/80 border-b border-border-custom">
      <div className="max-w-7xl mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="w-7 h-7 rounded-md bg-accent flex items-center justify-center">
            <svg viewBox="0 0 20 20" className="w-4 h-4 text-white" fill="currentColor">
              <rect x="2" y="8" width="7" height="10" rx="1" />
              <rect x="11" y="4" width="7" height="14" rx="1" />
              <circle cx="5.5" cy="6" r="2" />
              <circle cx="14.5" cy="2" r="2" />
            </svg>
          </span>
          <span className="font-bold text-lg tracking-tight text-text group-hover:text-accent transition-colors">
            BrickArt
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href.split("#")[0]) && item.href !== "/";

            return item.href.startsWith("/#") ? (
              <button
                key={item.label}
                onClick={() => handleNav(item.href)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {item.label}
              </button>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  active ? "text-text" : "text-muted hover:text-text"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-muted hover:text-text transition-colors px-4 py-2"
          >
            Log in
          </Link>
          <Link
            href="/create"
            className="text-sm font-medium bg-accent hover:bg-accent-hover text-white px-5 py-2 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden w-10 h-10 flex items-center justify-center text-muted hover:text-text transition-colors"
          aria-label="Menu"
        >
          {open ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-border-custom bg-bg/95 backdrop-blur-md">
          <nav className="flex flex-col px-6 py-4 gap-1">
            {NAV.map((item) =>
              item.href.startsWith("/#") ? (
                <button
                  key={item.label}
                  onClick={() => handleNav(item.href)}
                  className="text-left px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-surface transition-colors"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-surface transition-colors"
                >
                  {item.label}
                </Link>
              )
            )}
            <hr className="border-border-custom my-2" />
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-text hover:bg-surface transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/create"
              onClick={() => setOpen(false)}
              className="px-4 py-3 rounded-lg text-sm font-medium bg-accent text-white text-center hover:bg-accent-hover transition-colors"
            >
              Get started
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
