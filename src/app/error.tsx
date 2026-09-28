"use client";

import Link from "next/link";

const PRIMARY =
  "pressable inline-flex h-11 items-center rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";
const SECONDARY =
  "pressable inline-flex h-11 items-center rounded-[2px] border border-line-strong bg-pitch px-4 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint";

/**
 * A page that throws (the league feed is down, the database blinked) keeps
 * the nav and says so plainly, with a retry that re-fetches rather than a
 * blank screen. The digest is the one thing worth reading out to support.
 */
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-1 flex-col justify-center px-4 py-16 sm:px-8">
      <p className="annot">{"// stoppage"}</p>
      <h1 className="display mt-3 text-5xl sm:text-7xl">
        play stopped
        <span aria-hidden className="ml-[0.08em] inline-block h-[0.14em] w-[0.14em] bg-doubt align-baseline" />
      </h1>
      <p className="mt-4 max-w-[46ch] text-[15px] leading-relaxed text-ink-dim">
        This page could not load its data just now. Try again, and if it keeps happening the reference below tells
        us where to look.
      </p>
      {error.digest ? <p className="num mt-3 text-[12px] text-ink-faint">ref {error.digest}</p> : null}
      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className={PRIMARY}>
          try again
        </button>
        <Link href="/" className={SECONDARY}>
          back to the hub
        </Link>
      </div>
    </main>
  );
}
