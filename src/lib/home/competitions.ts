/**
 * The season by competition: the league as a record and a place in the table,
 * each cup as a run of ties and a record. One pass over results and fixtures,
 * read by the home slide (a row a competition) and the season slide (a section
 * a competition). Pure functions, no I/O.
 */
import type { Fixture, Result, Standing } from "@/lib/types";

import { cupRuns, splitCompetition, type CupRun } from "./cups";
import { isLeague } from "./season-context";

export type CompetitionRecord = { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number };

export type LeagueStanding = {
  record: CompetitionRecord;
  position: number | null;
  teams: number;
  /** the next league fixture on or after asOf */
  next: Fixture | null;
};

export type CupStanding = CupRun & { record: CompetitionRecord };

export type SeasonByCompetition = {
  league: LeagueStanding;
  cups: CupStanding[];
  /** how many competitions have a game played or in the diary */
  count: number;
};

const pts = (r: Pick<Result, "goals_for" | "goals_against">) => (r.goals_for > r.goals_against ? 3 : r.goals_for === r.goals_against ? 1 : 0);

export function recordOf(games: readonly Pick<Result, "goals_for" | "goals_against">[]): CompetitionRecord {
  const won = games.filter((g) => pts(g) === 3).length;
  const drawn = games.filter((g) => pts(g) === 1).length;
  return {
    played: games.length,
    won,
    drawn,
    lost: games.length - won - drawn,
    gf: games.reduce((n, g) => n + g.goals_for, 0),
    ga: games.reduce((n, g) => n + g.goals_against, 0),
    points: won * 3 + drawn,
  };
}

/** "4w 2d 1l" with a goal line, the way a record is said. */
export function recordLine(r: CompetitionRecord): string {
  return `${r.won}w ${r.drawn}d ${r.lost}l · ${r.gf}:${r.ga}`;
}

export function seasonByCompetition(input: { results: readonly Result[]; fixtures: readonly Fixture[]; standings: readonly Standing[]; asOf: string }): SeasonByCompetition {
  const league = input.results.filter((r) => isLeague(r.competition));
  const us = input.standings.find((s) => s.is_us) ?? null;
  // the table is the truth for the league once there is one; results fill in before the first snapshot
  const record: CompetitionRecord = us
    ? { played: us.played, won: us.won, drawn: us.drawn, lost: us.lost, gf: us.gf, ga: us.ga, points: us.points }
    : recordOf(league);
  const next = [...input.fixtures].filter((f) => isLeague(f.competition) && f.match_date >= input.asOf).sort((a, b) => a.match_date.localeCompare(b.match_date))[0] ?? null;

  const cups: CupStanding[] = cupRuns(input.results, input.fixtures, input.asOf).map((run) => ({
    ...run,
    record: recordOf(input.results.filter((r) => !isLeague(r.competition) && splitCompetition(r.competition).name === run.name)),
  }));

  const leagueLive = record.played > 0 || next !== null;
  return { league: { record, position: us?.position ?? null, teams: input.standings.length, next }, cups, count: Number(leagueLive) + cups.length };
}
