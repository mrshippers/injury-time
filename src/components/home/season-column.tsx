import { Crest } from "@/components/club/crest";
import { MarkRow, StatReading } from "@/components/charts";
import { shortDate } from "@/components/squad/format";
import { recordLine, type SeasonByCompetition } from "@/lib/home/competitions";
import { ordinal, type SeasonContext } from "@/lib/home/season-context";

const STATE: Record<SeasonByCompetition["cups"][number]["state"], string> = { in: "still in", out: "out", waiting: "awaiting draw" };

/**
 * The season beside the next game: the one number, then a row a competition.
 * League first with its place in the table, each cup with the round it stands
 * at. Enough to know where the season is before swiping for the detail.
 */
export function SeasonColumn({ ctx, s, fit, squadSize }: { ctx: SeasonContext; s: SeasonByCompetition; fit: number; squadSize: number }) {
  const { league, cups } = s;
  return (
    <section aria-labelledby="season-col" className="min-w-0 border-t border-line pt-3">
      <p className="annot" id="season-col">{"// the season"}</p>
      <div className="mt-3">
        {ctx.hasSeason ? (
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <StatReading value={String(ctx.points)} unit="pts" label={ctx.position ? `${ordinal(ctx.position)} of ${ctx.teams} · ${ctx.played} played` : `${ctx.played} played`} note={ctx.sentences[0]} size="md" glow />
            <MarkRow label="last six league games, oldest first" marks={ctx.form.map((f) => ({ result: f.result, title: `${f.score} ${f.venue === "A" ? "at" : "v"} ${f.opponent}, ${shortDate(f.date)}` }))} />
          </div>
        ) : (
          <StatReading value={String(fit)} unit={`of ${squadSize}`} label="available for the next match" size="md" glow tone={fit >= 11 ? "ink" : "bad"} />
        )}
      </div>
      <ul className="mt-4 flex flex-col">
        {league.record.played > 0 || league.next ? (
          <li className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0">
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-semibold text-ink">league</span>
              <span className="num block text-[11.5px] text-ink-dim">{league.record.played > 0 ? recordLine(league.record) : "first game to come"}</span>
            </span>
            <span className="num shrink-0 text-right text-[11.5px] text-ink-dim">
              {league.position ? <span className="block font-semibold text-ink">{ordinal(league.position)}</span> : null}
              {league.next ? (
                <span className="inline-flex items-center gap-1.5">
                  {shortDate(league.next.match_date)} {league.next.venue === "A" ? "at" : "v"} <Crest team={league.next.opponent} size={14} /> {league.next.opponent}
                </span>
              ) : (
                <span>no league game in the diary</span>
              )}
            </span>
          </li>
        ) : null}
        {cups.map((c) => {
          const next = c.ties.find((t) => !t.tone);
          const last = c.ties.filter((t) => t.tone).at(-1);
          return (
            <li key={c.name} className="flex items-baseline justify-between gap-3 border-t border-line py-2 first:border-t-0">
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-semibold text-ink">{c.name}</span>
                <span className="num block text-[11.5px] text-ink-dim">{c.record.played > 0 ? recordLine(c.record) : "not started"}</span>
              </span>
              <span className={`num shrink-0 text-right text-[11.5px] ${c.state === "out" ? "text-out" : "text-ink-dim"}`}>
                <span className={`block font-semibold ${c.state === "out" ? "text-out" : "text-ink"}`}>{STATE[c.state]}</span>
                {next ? (
                  <span className="inline-flex items-center gap-1.5">
                    {next.round} · {shortDate(next.date)} {next.venue === "A" ? "at" : "v"} <Crest team={next.opponent} size={14} /> {next.opponent}
                  </span>
                ) : last ? (
                  <span>
                    {last.round} · {last.score} {last.venue === "A" ? "at" : "v"} {last.opponent}
                  </span>
                ) : null}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
