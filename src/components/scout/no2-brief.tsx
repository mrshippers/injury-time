"use client";

import { useState, useTransition } from "react";

import { writeBriefAction } from "@/lib/ai/actions";
import type { Brief } from "@/lib/scout/brief";

/** The analyst's read of the numbers: written once per match on request, then kept. */
export function No2Brief({ fixtureId, initial }: { fixtureId: string; initial: Brief | null }) {
  const [brief, setBrief] = useState<Brief | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!brief)
    return (
      <div className="mt-5">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await writeBriefAction(fixtureId);
              if (res.ok) setBrief(res.value);
              else setError(res.error);
            })
          }
          className="plate pressable bg-mint py-2.5 text-[13px] font-semibold text-mint-ink transition-transform duration-200 hover:translate-x-0.5 disabled:opacity-60"
        >
          {pending ? "the analyst is writing it up" : "get the analyst's read"}
        </button>
        {pending ? <span aria-hidden className="route-bar ml-3 inline-block h-[3px] w-16 bg-mint align-middle" /> : null}
        {error ? <p className="mt-2 text-[12.5px] text-doubt">{error}</p> : null}
      </div>
    );
  return (
    <div data-stagger className="mt-6 flex flex-col gap-4" aria-live="polite">
      <p className="display text-[22px] leading-tight text-ink">{brief.headline}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Line k="our edge" v={brief.edge} />
        <Line k="where they hurt us" v={brief.danger} />
      </div>
      <div>
        <p className="num text-[10.5px] uppercase tracking-[0.12em] text-ink-dim">game states</p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {brief.game_states.map((g) => (
            <li key={g} className="relative pl-5 text-[14px] leading-snug text-ink">
              <span aria-hidden className="absolute left-0 top-[0.62em] h-px w-3 bg-gold" />
              {g}
            </li>
          ))}
        </ul>
      </div>
      <Line k="the number to watch" v={brief.watch} />
    </div>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="num text-[10.5px] uppercase tracking-[0.12em] text-ink-dim">{k}</p>
      <p className="mt-1 text-[14px] leading-snug text-ink">{v}</p>
    </div>
  );
}
