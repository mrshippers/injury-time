"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { PlateTabs } from "@/components/ui/plate-tabs";

export type HubPage = { key: string; label: string; content: ReactNode };

/**
 * The hub as stages you swipe through, not a page you scroll down: one screen, the next game first. Native
 * horizontal scroll-snap does the swiping (thumb, trackpad, shift-wheel); the tabs, the arrows and the
 * keyboard move it too. Whichever stage is on screen is marked active so its contents ease in.
 */
export function HubPager({ pages }: { pages: HubPage[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(pages[0]?.key ?? "");

  // the stage on screen is the one most visible in the track
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting && e.intersectionRatio > 0.6) setActive((e.target as HTMLElement).dataset.key ?? "");
      },
      { root: el, threshold: [0.6] },
    );
    el.querySelectorAll<HTMLElement>("[data-page]").forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, [pages.length]);

  const go = useCallback((key: string) => {
    const el = track.current?.querySelector<HTMLElement>(`[data-page][data-key="${key}"]`);
    if (!el || !track.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.current.scrollTo({ left: el.offsetLeft, behavior: reduced ? "auto" : "smooth" });
    setActive(key);
  }, []);

  const step = (d: number) => {
    const i = pages.findIndex((p) => p.key === active);
    const next = pages[Math.min(pages.length - 1, Math.max(0, i + d))];
    if (next) go(next.key);
  };
  const i = pages.findIndex((p) => p.key === active);

  return (
    <section aria-roledescription="carousel" aria-label="the hub" className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-3">
        <div className="-mx-1 min-w-0 overflow-x-auto [scrollbar-width:none]">
          <PlateTabs label="hub stages" items={pages.map((p) => ({ key: p.key, label: p.label }))} active={active} onChange={go} />
        </div>
        <div className="flex shrink-0 items-center gap-1 max-sm:hidden">
          <Arrow dir="prev" disabled={i <= 0} onClick={() => step(-1)} />
          <span className="num w-10 text-center text-[11px] text-ink-dim tabular-nums">
            {i + 1}/{pages.length}
          </span>
          <Arrow dir="next" disabled={i >= pages.length - 1} onClick={() => step(1)} />
        </div>
      </div>
      <div
        ref={track}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") {
            e.preventDefault();
            step(1);
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            step(-1);
          }
        }}
        className="pager-track mt-4 flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-none"
      >
        {pages.map((p, n) => (
          <div
            key={p.key}
            data-page
            data-key={p.key}
            data-active={p.key === active ? "true" : "false"}
            role="group"
            aria-roledescription="slide"
            aria-label={`${n + 1} of ${pages.length}: ${p.label}`}
            // a stage that scrolls (the league table) has to be reachable by keyboard
            tabIndex={0}
            className="w-full min-w-full shrink-0 snap-start snap-always overflow-y-auto overscroll-y-contain pb-6 pr-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-mint/60"
          >
            {p.content}
          </div>
        ))}
      </div>
      <div aria-hidden className="mt-2 flex justify-center gap-1.5 sm:hidden">
        {pages.map((p) => (
          <span key={p.key} className={`block h-1.5 -skew-x-[20deg] transition-all duration-300 ${p.key === active ? "w-6 bg-mint" : "w-2.5 bg-line-strong"}`} />
        ))}
      </div>
    </section>
  );
}

function Arrow({ dir, disabled, onClick }: { dir: "prev" | "next"; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={dir === "prev" ? "previous stage" : "next stage"}
      disabled={disabled}
      onClick={onClick}
      className="pressable flex h-8 w-8 items-center justify-center text-ink-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:opacity-30"
    >
      <svg aria-hidden viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
      </svg>
    </button>
  );
}
