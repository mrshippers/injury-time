"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import type { ClubRole } from "@/lib/types";

import { switchClub } from "./actions";

/**
 * FM-style module bar. One row, every module one tap away from every page.
 * The wordmark's mint full stop is the brand; the active module underlines
 * in the same mint so "where am I" and "what is this" share one colour.
 * A guest can swap between the public clubs; a member sees their own.
 */
const MODULES: { href: string; label: string; match: (p: string) => boolean }[] = [
  { href: "/", label: "hub", match: (p) => p === "/" },
  { href: "/squad", label: "squad", match: (p) => p.startsWith("/squad") || p.startsWith("/player") || p.startsWith("/lineup") },
  { href: "/team", label: "team", match: (p) => p.startsWith("/team") },
  { href: "/film", label: "film", match: (p) => p.startsWith("/film") },
  { href: "/log", label: "log", match: (p) => p.startsWith("/log") },
];

export type NavClub = { id: string; name: string; slug: string | null };

export type SiteNavProps = {
  role: ClubRole;
  guest: boolean;
  club: NavClub;
  clubs: NavClub[];
};

export function SiteNav({ role, guest, club, clubs }: SiteNavProps) {
  const pathname = usePathname() ?? "/";
  const router = useRouter();
  const [pending, start] = useTransition();
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return null;

  const canSwitch = guest && clubs.length > 1;

  return (
    <nav
      aria-label="modules"
      className="sticky top-0 z-30 border-b border-line bg-pitch/85 backdrop-blur-md"
    >
      <div className="mx-auto flex h-12 w-full max-w-[1240px] items-center justify-between gap-2 px-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link href="/" className="pressable display shrink-0 text-[17px] leading-none text-ink" aria-label="injury time, hub">
            <span>injury time</span>
            <span aria-hidden className="ml-[0.08em] inline-block h-[0.16em] w-[0.16em] bg-mint align-baseline" />
          </Link>
          {canSwitch ? (
            <label className="flex min-w-0 items-center gap-1.5">
              <span className="sr-only">club</span>
              <select
                value={club.id}
                disabled={pending}
                onChange={(e) => {
                  const id = e.target.value;
                  start(async () => {
                    await switchClub(id);
                    router.refresh();
                  });
                }}
                className="num max-w-[11rem] truncate rounded-[2px] border border-line bg-panel px-2 py-[3px] text-[12px] tracking-[0.04em] text-ink-dim outline-none transition-colors duration-[190ms] hover:text-ink focus-visible:ring-2 focus-visible:ring-mint sm:max-w-none sm:min-h-0 sm:px-1.5 sm:text-[11px] sm:tracking-[0.06em]"
              >
                {clubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="num hidden truncate text-[11px] tracking-[0.06em] text-ink-dim sm:inline">{club.name}</span>
          )}
        </div>
        <ul className="hidden shrink-0 items-center gap-2 sm:flex">
          {MODULES.map((m) => {
            const active = m.match(pathname);
            return (
              <li key={m.href}>
                <Link
                  href={m.href}
                  aria-current={active ? "page" : undefined}
                  className={`pressable relative block px-1.5 py-1.5 text-[12.5px] font-semibold tracking-[0.04em] transition-colors duration-[190ms] sm:px-2.5 sm:tracking-[0.06em] ${
                    active ? "text-ink" : "text-ink-dim hover:text-ink"
                  }`}
                >
                  {m.label}
                  <span
                    aria-hidden
                    className={`absolute inset-x-1.5 -bottom-[13px] h-[2px] bg-mint transition-opacity duration-[190ms] sm:inset-x-2.5 ${active ? "opacity-100" : "opacity-0"}`}
                  />
                </Link>
              </li>
            );
          })}
          <li className="hidden pl-2 md:block">
            <span
              className="annot text-[10.5px] text-gold-dim"
              title={guest ? "signed out: looking at a public club as its manager" : `signed in as ${role}`}
            >
              {guest ? `// guest · ${role}` : `// ${role}`}
            </span>
          </li>
        </ul>
        <span className="annot shrink-0 text-gold-dim sm:hidden" aria-hidden>
          {`// ${role}`}
        </span>
      </div>
    </nav>
  );
}

/**
 * On a phone the modules live at the bottom, under the thumb, like the tab
 * bar of any app worth opening on a touchline. Same five words, same mint
 * mark for "where am I", fixed above the safe area.
 */
export function PhoneTabBar() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/login") || pathname.startsWith("/auth")) return null;
  return (
    <nav
      aria-label="modules"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line-strong bg-panel sm:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)", boxShadow: "inset 0 1px 0 0 var(--sheen-edge)" }}
    >
      <ul className="grid h-14 grid-cols-5">
        {MODULES.map((m) => {
          const active = m.match(pathname);
          return (
            <li key={m.href} className="relative">
              <Link
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={`pressable flex h-full min-h-[44px] items-center justify-center text-[13px] font-semibold tracking-[0.06em] outline-none transition-colors duration-[190ms] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint ${
                  active ? "text-ink" : "text-ink-dim"
                }`}
              >
                {m.label}
              </Link>
              <span
                aria-hidden
                className={`absolute inset-x-3 top-0 h-[2px] bg-mint transition-opacity duration-[190ms] ${active ? "opacity-100 glow-mint" : "opacity-0"}`}
              />
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
