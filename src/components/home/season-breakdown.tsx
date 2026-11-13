import { Crest } from "@/components/club/crest";
import { StatReading } from "@/components/charts";
import { CongestionPanel } from "@/components/home/congestion-panel";
import { CupRunBlock } from "@/components/home/cups";
import { SeasonLine } from "@/components/home/season-line";
import { FormVital } from "@/components/home/vitals";
import { shortDate } from "@/components/squad/format";
import { recordLine, type SeasonByCompetition } from "@/lib/home/competitions";
import type { Congestion } from "@/lib/home/congestion";
import type { HomeSeason } from "@/lib/home/data";
import { ordinal, type SeasonContext } from "@/lib/home/season-context";
import type { Fixture } from "@/lib/types";

/**
 * The season slide: one section a competition, the league first. The league
 * gets its points line, its form and the pace sentences; each cup gets its run
 * of ties and its record. A section only appears for a competition the club
 * has actually played or has in the diary.
 */
export function SeasonBreakdown({
  ctx,
  s,
  season,
  asOf,
  congestion,
}: {
  ctx: SeasonContext;
  s: SeasonByCompetition;
  season: Pick<HomeSeason, "results" | "fixtures">;
  asOf: string;
  congestion: Congestion | null;
}) {
  const { league, cups } = s;
  const leagueLive = league.record.played > 0 || league.next;
  return (
    <div data-stagger className="flex flex-col gap-10">
      {leagueLive ? (
        <section aria-labelledby="season-league" className="border-t border-line pt-3">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="display text-[22px] leading-none text-ink" id="season-league">
              league
              <span className="num ml-3 align-middle text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-dim">
                {league.position ? `${ordinal(league.position)} of ${league.teams}` : `${league.record.played} played`}
              </span>
            </h2>
            <p className="num text-[12.5px] text-ink-dim">{league.record.played > 0 ? recordLine(league.record) : "no league games in yet"}</p>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:items-end">
            <div>
              {ctx.hasSeason ? <StatReading value={String(ctx.points)} unit="pts" label={`${ctx.ppg.toFixed(2)} a game`} size="md" glow /> : null}
              <ul className="mt-4 flex max-w-[40ch] flex-col gap-1.5">
                {ctx.sentences.map((t) => (
                  <li key={t} className="text-[14px] leading-snug text-ink">
                    {t}
                  </li>
                ))}
              </ul>
              <NextLine next={league.next} />
            </div>
            <div className="min-w-0">{ctx.hasSeason ? <SeasonLine ctx={ctx} results={season.results} fixtures={season.fixtures} asOf={asOf} /> : null}</div>
          </div>
          <div className="mt-6 max-w-[520px]">
            <FormVital ctx={ctx} results={season.results} />
          </div>
        </section>
      ) : null}
      {cups.map((c) => (
        <section key={c.name} aria-label={c.name} className="border-t border-line pt-3">
          <CupRunBlock run={c} aside={c.record.played > 0 ? <span className="num ml-2 text-ink-dim">· {recordLine(c.record)}</span> : null} />
        </section>
      ))}
      {congestion ? <CongestionPanel c={congestion} /> : null}
    </div>
  );
}

function NextLine({ next }: { next: Fixture | null }) {
  if (!next) return null;
  return (
    <p className="mt-4 text-[12.5px] text-ink-dim">
      <span className="annot mr-2 text-[10px]">next league game</span>
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="num">{shortDate(next.match_date)}</span>
        {next.venue === "A" ? "at" : "v"} <Crest team={next.opponent} size={16} /> <span className="text-ink">{next.opponent}</span>
      </span>
    </p>
  );
}
