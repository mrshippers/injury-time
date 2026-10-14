import { SEASON_BENCHMARKS } from "@/lib/config";
import type { SeasonContext } from "@/lib/home/season-context";
import { isLeague } from "@/lib/home/season-context";
import type { Fixture, Result } from "@/lib/types";
import { shortDate } from "@/components/squad/format";

import { HairlineLine, type LineSeries, type ReferenceLine, type VerticalMark } from "@/components/charts";

/**
 * The season as one line: points after every league game, the two paces that
 * matter drawn from the origin, Christmas marked where the diary puts it, and
 * one annotation on the game that turned. The end reading is the table.
 */
export function SeasonLine({ ctx, results, fixtures, asOf }: { ctx: SeasonContext; results: Result[]; fixtures: Fixture[]; asOf: string }) {
  const played = ctx.line.length;
  const leagueLeft = fixtures.filter((f) => isLeague(f.competition) && f.match_date > asOf).length;
  const xmasIndex = played + ctx.leagueGamesToChristmas;
  // the drawing runs to a few games past christmas, not to may: the near
  // future is the decision, the far one is arithmetic
  const horizon = Math.min(SEASON_BENCHMARKS.gamesInSeason, Math.max(played + 6, ctx.leagueGamesToChristmas > 0 ? xmasIndex + 3 : played + Math.min(leagueLeft, 12)));
  const maxY = Math.max(ctx.points + 10, Math.ceil((SEASON_BENCHMARKS.promotionPpg * horizon + 4) / 10) * 10);

  // each dot is the game that made it: won, drawn or lost, said in words on hover, focus or tap
  const leagueGames = results.filter((r) => isLeague(r.competition)).sort((a, b) => a.match_date.localeCompare(b.match_date));
  const series: LineSeries[] = [
    {
      name: "points",
      rank: 0,
      reading: `${ctx.points}`,
      glow: true,
      points: ctx.line.map((p, i) => {
        const g = leagueGames.length === ctx.line.length ? leagueGames[i] : undefined;
        if (!g) return { x: p.matchNo, y: p.points, label: `game ${p.matchNo}, ${shortDate(p.date)}: ${p.points} pts` };
        const tone = g.goals_for > g.goals_against ? "win" : g.goals_for === g.goals_against ? "draw" : "loss";
        const verb = tone === "win" ? "Won" : tone === "draw" ? "Drew" : "Lost";
        const score = `${g.goals_for}-${g.goals_against}`;
        return {
          x: p.matchNo,
          y: p.points,
          tone,
          tip: [`${verb} ${score} ${g.venue === "A" ? "at" : "v"} ${g.opponent}`, `${shortDate(p.date)} · ${p.points} pts after ${p.matchNo}`] as [string, string],
        };
      }),
    },
  ];
  const refs = (promotion: string, playoffs: string): ReferenceLine[] => [
    { from: { x: 0, y: 0 }, to: { x: horizon, y: SEASON_BENCHMARKS.promotionPpg * horizon }, label: promotion },
    { from: { x: 0, y: 0 }, to: { x: horizon, y: SEASON_BENCHMARKS.playoffPpg * horizon }, label: playoffs },
  ];
  const references = refs("promotion pace", "play-offs");
  const verticals: VerticalMark[] = ctx.leagueGamesToChristmas > 0 && xmasIndex <= horizon ? [{ x: xmasIndex, label: "christmas", tone: "gold" }] : [];

  // the game that turned: the heaviest defeat this season, else the biggest win
  const league = results.filter((r) => isLeague(r.competition)).sort((a, b) => a.match_date.localeCompare(b.match_date));
  let annotation: { at: number; y: number; text: string; tone: "bad" | "good" } | undefined;
  if (league.length > 0) {
    let idx = -1;
    let swing = 0;
    league.forEach((r, i) => {
      const d = r.goals_against - r.goals_for;
      if (d > swing) {
        swing = d;
        idx = i;
      }
    });
    if (idx >= 0) {
      const r = league[idx];
      annotation = { at: idx + 1, y: ctx.line[idx]?.points ?? 0, text: `${r.goals_for}-${r.goals_against} ${r.venue === "A" ? "at" : "v"} ${r.opponent.toLowerCase()}`, tone: "bad" };
    } else {
      let best = -1;
      let margin = -1;
      league.forEach((r, i) => {
        const d = r.goals_for - r.goals_against;
        if (d > margin) {
          margin = d;
          best = i;
        }
      });
      const r = league[best];
      annotation = { at: best + 1, y: ctx.line[best]?.points ?? 0, text: `${r.goals_for}-${r.goals_against} ${r.venue === "A" ? "at" : "v"} ${r.opponent.toLowerCase()}`, tone: "good" };
    }
  }

  const ticks = (xStep: number, yStep: number) => ({
    x: Array.from({ length: Math.floor(horizon / xStep) }, (_, i) => ({ x: (i + 1) * xStep, label: `${(i + 1) * xStep}` })),
    y: Array.from({ length: Math.floor(maxY / yStep) }, (_, i) => (i + 1) * yStep),
  });
  const wide = ticks(5, 10);
  const narrow = ticks(10, 20);
  const shared = {
    title: `points after each league game, ${ctx.points} after ${played}. Hover or tap a dot for the result.`,
    series,
    xDomain: [0, horizon] as [number, number],
    yDomain: [0, maxY] as [number, number],
    yUnit: "pts",
    verticals,
    annotation,
  };

  return (
    <div>
      <ul className="num mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-dim" aria-label="what the dots mean">
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-2.5 rounded-full bg-[var(--win)]" />won</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-2.5 rounded-full bg-ink" />drawn</li>
        <li className="flex items-center gap-1.5"><span aria-hidden className="inline-block size-2.5 rounded-full border-[2px] border-out bg-panel" />lost</li>
      </ul>
      <div className="hidden md:block">
        <HairlineLine {...shared} references={references} xTicks={wide.x} yTicks={wide.y} width={860} height={250} readingWidth={120} />
      </div>
      <div className="md:hidden">
        <HairlineLine {...shared} references={refs("up", "play-offs")} xTicks={narrow.x} yTicks={narrow.y} width={390} height={230} readingWidth={84} />
      </div>
    </div>
  );
}
