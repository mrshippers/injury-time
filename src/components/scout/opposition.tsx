import { Crest } from "@/components/club/crest";
import { getNote } from "@/lib/ai/notes";
import { aiConfigured } from "@/lib/ai/claude";
import type { Brief, ScoutFacts } from "@/lib/scout/brief";

import { No2Brief } from "./no2-brief";

const KEY = "num text-[10.5px] uppercase tracking-[0.12em] text-ink-dim";
const pct = (n: number) => `${Math.round(n * 100)}%`;
const hot = (d: number) => (d >= 2 ? `running hot, ${d} pts above what their goals earn` : d <= -2 ? `unlucky, ${Math.abs(d)} pts below what their goals earn` : "about where their goals say");

/**
 * The opposition: the model's numbers, always there, then the No.2's plan on top. The result bar carries
 * each answer's word and percentage on the segment itself, so it never rests on colour.
 */
export async function Opposition({ clubId, fixtureId, facts }: { clubId: string; fixtureId: string; facts: ScoutFacts }) {
  const stored = await getNote<Brief>(clubId, "brief", fixtureId);
  const { odds, them, us } = facts;
  const theirVenue = facts.venue === "H" ? them.awayPpg : them.homePpg;
  return (
    <section id="opposition" aria-labelledby="opp-h" className="mt-8 scroll-mt-20">
      <div className="flex items-center gap-3">
        <Crest team={facts.opponent} size={28} plain />
        <p className="annot" id="opp-h">{`// the opposition · ${facts.opponent.toLowerCase()}`}</p>
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

      <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <div>
          <dt className={KEY}>goals we should score</dt>
          <dd className="num mt-1 text-[22px] font-semibold text-ink tabular-nums">{odds.xgFor}</dd>
        </div>
        <div>
          <dt className={KEY}>goals they should score</dt>
          <dd className="num mt-1 text-[22px] font-semibold text-ink tabular-nums">{odds.xgAgainst}</dd>
        </div>
        <div>
          <dt className={KEY}>likeliest scores</dt>
          <dd className="num mt-1 text-[15px] font-semibold text-ink">{odds.scorelines.map((s) => s.score).join(" · ")}</dd>
        </div>
        <div>
          <dt className={KEY}>them {facts.venue === "H" ? "away" : "at home"}</dt>
          <dd className="num mt-1 text-[15px] font-semibold text-ink">{theirVenue !== null ? `${theirVenue} pts a game` : "-"}</dd>
        </div>
      </dl>

      <ul className="mt-4 flex flex-col gap-1 text-[13px] text-ink-dim">
        <li>
          <span className="text-ink">{facts.opponent}</span>: {them.position}th, {them.points} pts from {them.played}, {hot(them.luck)}.
        </li>
        <li>
          <span className="text-ink">us</span>: {us.position}th, {hot(us.luck)}.
        </li>
        {facts.meetings.length ? (
          <li>
            this season: {facts.meetings.map((m) => `${m.score} ${m.venue === "H" ? "at home" : "away"}`).join(", ")}
          </li>
        ) : null}
      </ul>

      {aiConfigured() || stored ? <No2Brief fixtureId={fixtureId} initial={stored?.body ?? null} /> : null}
    </section>
  );
}
