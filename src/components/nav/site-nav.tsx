"use client";

import Link from "next/link";

import { Mark } from "@/components/brand/mark";
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
  { href: "/club", label: "club", match: (p) => p.startsWith("/club") },
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
  if (pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/checkin")) return null;

  const canSwitch = guest && clubs.length > 1;

  return (
    <nav
      aria-label="modules"
      className="sticky top-0 z-30 border-b border-line bg-pitch/85 pt-[env(safe-area-inset-top)] backdrop-blur-md"
    >
      <div className="mx-auto flex h-12 w-full max-w-[1240px] items-center justify-between gap-2 px-3 sm:px-8">
        <div className="flex min-w-0 items-center gap-2 sm:gap-4">
          <Link href="/" className="pressable display flex shrink-0 items-center gap-1.5 text-[17px] leading-none text-ink" aria-label="injury time, hub">
            <Mark height={24} className="shrink-0" />
            {/* on a phone the mark is the brand; the club picker and role need the room */}
            <span className="hidden sm:inline">
              injury time
              <span aria-hidden className="ml-[0.08em] inline-block h-[0.16em] w-[0.16em] bg-mint align-baseline" />
            </span>
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
 * bar of any app worth opening on a touchline. Same six words, same mint
 * mark for "where am I", fixed above the safe area.
 */
export function PhoneTabBar() {
  const pathname = usePathname() ?? "/";
  if (pathname.startsWith("/login") || pathname.startsWith("/auth") || pathname.startsWith("/checkin")) return null;
  return (
    <nav aria-label="modules" className="tabbar fixed inset-x-0 bottom-0 z-30 sm:hidden">
      <ul className="grid grid-cols-6 px-1.5 pt-1.5">
        {MODULES.map((m) => {
          const active = m.match(pathname);
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={`pressable tab ${active ? "is-active" : ""}`}
              >
                <TabIcon name={m.label} />
                <span>{m.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** One-stroke glyphs, drawn on the same 24 grid, round caps: lines, not boxes. */
function TabIcon({ name }: { name: string }) {
  const d: Record<string, string> = {
    hub: "M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10",
    squad: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-5.5 8c.6-3 2.9-5 5.5-5s4.9 2 5.5 5M16 5.2a3 3 0 0 1 0 5.6M18 14.4c1.4.8 2.3 2.4 2.6 4.6",
    team: "M5 6.5h14M5 12h14M5 17.5h9",
    film: "M4.5 7.5a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-9Zm11 3.5 4-2.5v7l-4-2.5",
    log: "M12 7v5l3 2M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z",
    club: "M12 4c2.5 1.6 5 2.2 7 2.2 0 6.3-2.6 10.6-7 13.3-4.4-2.7-7-7-7-13.3 2 0 4.5-.6 7-2.2Z",
  };
  return (
    <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d={d[name]} />
    </svg>
  );
}
