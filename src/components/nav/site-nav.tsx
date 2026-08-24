"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * FM-style module bar. One row, every module one tap away from every page.
 * The wordmark's mint full stop is the brand; the active module underlines
 * in the same mint so "where am I" and "what is this" share one colour.
 */
const MODULES: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/", label: "hub", match: (p) => p === "/" },
  { href: "/squad", label: "squad", match: (p) => p.startsWith("/squad") || p.startsWith("/player") },
  { href: "/lineup", label: "lineup", match: (p) => p.startsWith("/lineup") },
  { href: "/log", label: "log", match: (p) => p.startsWith("/log") },
];

export function SiteNav() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return null;
  return (
    <nav
      aria-label="modules"
      className="sticky top-0 z-30 border-b border-line bg-pitch/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-12 w-full max-w-[1240px] items-center justify-between px-4 sm:px-8">
        <Link href="/" className="pressable display text-[17px] leading-none text-ink">
          injury time
          <span aria-hidden className="ml-[0.08em] inline-block h-[0.16em] w-[0.16em] bg-mint align-baseline" />
        </Link>
        <ul className="flex items-center gap-1 sm:gap-2">
          {MODULES.map((m) => {
            const active = m.match(pathname);
            return (
              <li key={m.href}>
                <Link
                  href={m.href}
                  aria-current={active ? "page" : undefined}
                  className={`pressable relative block px-2.5 py-1.5 text-[12.5px] font-semibold tracking-[0.06em] transition-colors duration-[190ms] ${
                    active ? "text-ink" : "text-ink-dim hover:text-ink"
                  }`}
                >
                  {m.label}
                  <span
                    aria-hidden
                    className={`absolute inset-x-2.5 -bottom-[13px] h-[2px] bg-mint transition-opacity duration-[190ms] ${active ? "opacity-100" : "opacity-0"}`}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
