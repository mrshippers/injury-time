import { Crest } from "@/components/club/crest";
import { aiConfigured } from "@/lib/ai/claude";
import { getNote } from "@/lib/ai/notes";
import type { Brief, ScoutFacts } from "@/lib/scout/brief";

import { No2Brief } from "./no2-brief";

const KEY = "num text-[10.5px] uppercase tracking-[0.12em] text-ink-dim";
const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * The opposition: the model up top (result chances with the word and number on each segment, never colour
 * alone; xG both ways; likeliest scores), then the read, the handful of counted points that matter, then
 * the analyst's plan on request.
 */
export async function Opposition({ clubId, fixtureId, facts }: { clubId: string; fixtureId: string; facts: ScoutFacts }) {
  const stored = await getNote<Brief>(clubId, "brief", fixtureId);
  const { odds, read, them } = facts;
  return (
    <section id="opposition" aria-labelledby="opp-h" className="mt-8 scroll-mt-20">
      <div className="flex items-center gap-3">
        <Crest team={facts.opponent} size={28} plain />
        <p className="annot" id="opp-h">{`// the opposition · ${facts.opponent.toLowerCase()} · ${them.position}th`}</p>
      </div>

      <div className="mt-4 flex h-9 w-full overflow-hidden" role="img" aria-label={`win ${pct(odds.win)}, draw ${pct(odds.draw)}, lose ${pct(odds.loss)}`}>
        {(
          [
            ["win", odds.win, "bg-[var(--win)]/25 text-ink"],
            ["draw", odds.draw, "bg-panel-2 text-ink"],
            ["lose", odds.loss, "bg-out/20 text-ink"],
          ] as const
        ).map(([k, v, tone]) => (
          <span key={k} className={`plate num flex items-center justify-center whitespace-nowrap text-[11.5px] font-semibold uppercase tracking-[0.08em] ${tone}`} style={{ width: `${Math.max(v * 100, 12)}%` }}>
            {k} {pct(v)}
          </span>
        ))}
      </div>

      <dl className="mt-5 grid grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-6">
        {(
          [
            ["our xG", odds.xgFor.toFixed(2)],
            ["their xG", odds.xgAgainst.toFixed(2)],
            ["likeliest", odds.scorelines[0]?.score ?? "-"],
            ["both score", pct(read.lines.btts)],
            ["clean sheet", pct(read.lines.ourCleanSheet)],
            ["over 2.5", pct(read.lines.over25)],
          ] as const
        ).map(([k, v]) => (
          <div key={k}>
            <dt className={KEY}>{k}</dt>
            <dd className="num mt-1 text-[22px] font-semibold text-ink tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <p className={KEY}>the read</p>
        <ul data-stagger className="mt-2 flex flex-col divide-y divide-line border-y border-line">
          {read.points.map((p) => (
            <li key={p.key} className="grid gap-x-5 gap-y-0.5 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)]">
              <span className="num text-[11px] uppercase tracking-[0.1em] text-gold">{p.key}</span>
              <span className="text-[14px] leading-snug text-ink">{p.line}</span>
            </li>
          ))}
          {facts.meetings.length ? (
            <li className="grid gap-x-5 gap-y-0.5 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)]">
              <span className="num text-[11px] uppercase tracking-[0.1em] text-gold">this season</span>
              <span className="text-[14px] leading-snug text-ink">{facts.meetings.map((m) => `${m.score} ${m.venue === "H" ? "at home" : "away"}`).join(", ")}</span>
            </li>
          ) : null}
        </ul>
      </div>

      {aiConfigured() || stored ? <No2Brief fixtureId={fixtureId} initial={stored?.body ?? null} /> : null}
    </section>
  );
}
