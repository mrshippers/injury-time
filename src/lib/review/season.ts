/**
 * The season review the committee prints. Every line is derived from what the
 * club logged; nothing is estimated. The "did the red zone call it" count only
 * judges injuries where the player had enough load history to have a reading,
 * so a gap in logging is reported as a gap, never as a miss or a hit.
 */
import { flagFor, type LoadEntry, type LoadFlag } from "@/lib/load-engine";
import { isLeague } from "@/lib/league";
import type { BodyRegion, Severity } from "@/lib/types";

export type ReviewResult = { match_date: string; competition: string; goals_for: number; goals_against: number };
export type ReviewInjury = { id: string; player_id: string; body_region: BodyRegion; severity: Severity; occurred_on: string; resolved_on: string | null };

export type SeasonReview = {
  record: { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number };
  injuries: {
    count: number;
    ongoing: number;
    daysLost: number;
    byRegion: { region: BodyRegion; count: number }[];
    bySeverity: Record<Severity, number>;
  };
  /** the load flag the day before each injury */
  before: { injuryId: string; playerId: string; region: BodyRegion; occurred_on: string; flag: LoadFlag }[];
  redCalled: number;
  judged: number;
};

const DAY = 86_400_000;
const dayBefore = (d: string) => new Date(Date.parse(d) - DAY).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / DAY));

export function seasonReview(
  results: readonly ReviewResult[],
  injuries: readonly ReviewInjury[],
  loadsByPlayer: ReadonlyMap<string, readonly LoadEntry[]>,
  asOf: string,
): SeasonReview {
  const league = results.filter((r) => isLeague(r.competition));
  const won = league.filter((r) => r.goals_for > r.goals_against).length;
  const drawn = league.filter((r) => r.goals_for === r.goals_against).length;
  const record = {
    played: league.length,
    won,
    drawn,
    lost: league.length - won - drawn,
    gf: league.reduce((n, r) => n + r.goals_for, 0),
    ga: league.reduce((n, r) => n + r.goals_against, 0),
    points: won * 3 + drawn,
  };

  const regionCount = new Map<BodyRegion, number>();
  const bySeverity: Record<Severity, number> = { knock: 0, minor: 0, moderate: 0, severe: 0 };
  let daysLost = 0;
  for (const i of injuries) {
    regionCount.set(i.body_region, (regionCount.get(i.body_region) ?? 0) + 1);
    bySeverity[i.severity] += 1;
    daysLost += daysBetween(i.occurred_on, i.resolved_on ?? asOf);
  }

  const before = [...injuries]
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on))
    .map((i) => ({
      injuryId: i.id,
      playerId: i.player_id,
      region: i.body_region,
      occurred_on: i.occurred_on,
      flag: flagFor(loadsByPlayer.get(i.player_id) ?? [], dayBefore(i.occurred_on)),
    }));

  return {
    record,
    injuries: {
      count: injuries.length,
      ongoing: injuries.filter((i) => !i.resolved_on).length,
      daysLost,
      byRegion: [...regionCount].map(([region, count]) => ({ region, count })).sort((a, b) => b.count - a.count || a.region.localeCompare(b.region)),
      bySeverity,
    },
    before,
    redCalled: before.filter((b) => b.flag === "red").length,
    judged: before.filter((b) => b.flag !== "cold").length,
  };
}
