/**
 * The read on the opposition, past "their table against ours": what kind of games they play, how they do
 * at this venue against the rest of the league, whether they are on the way up or down since the last
 * table, how we do against sides like them, how we play the game state, and the lines the model gives.
 * Every line is counted from the league table snapshots and our own results. Pure, no I/O.
 */
import { crestKey } from "@/lib/crests";
import type { Result, Standing } from "@/lib/types";

import type { MatchOdds } from "./model";
import { findPatterns } from "./patterns";

export type ReadPoint = { key: string; line: string };

const ppg = (w = 0, d = 0, p = 0) => (p ? (w * 3 + d) / p : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Both teams to score, our clean sheet, over 2.5 goals: straight from the two scoring rates. */
export function lines(odds: Pick<MatchOdds, "xgFor" | "xgAgainst">) {
  const p0 = (l: number) => Math.exp(-l);
  const total = odds.xgFor + odds.xgAgainst;
  const under = p0(total) * (1 + total + (total * total) / 2);
  return {
    btts: r2((1 - p0(odds.xgFor)) * (1 - p0(odds.xgAgainst))),
    ourCleanSheet: r2(p0(odds.xgAgainst)),
    theirCleanSheet: r2(p0(odds.xgFor)),
    over25: r2(1 - under),
  };
}

/** Their record at this venue, and where it ranks in the league at that venue. */
export function venueRank(them: Standing, table: readonly Standing[], venue: "home" | "away") {
  const v = (s: Standing) => {
    const x = s[venue] ?? {};
    return ppg(x.w, x.d, x.p);
  };
  const sorted = [...table].filter((s) => (s[venue]?.p ?? 0) > 0).sort((a, b) => v(b) - v(a));
  const x = them[venue] ?? {};
  return { w: x.w ?? 0, d: x.d ?? 0, l: x.l ?? 0, p: x.p ?? 0, ppg: r2(v(them)), rank: sorted.findIndex((s) => s.team === them.team) + 1, of: sorted.length };
}

/** Points a game since an earlier table against their season rate, and the places moved. */
export function trend(now: Standing, before: Standing | undefined) {
  if (!before || now.played <= before.played) return null;
  const games = now.played - before.played;
  const recent = (now.points - before.points) / games;
  return { games, points: now.points - before.points, recent: r2(recent), season: r2(now.points / now.played), moved: before.position - now.position };
}

/** What kind of games they play, against the league. */
export function profile(them: Standing, table: readonly Standing[]) {
  const p = table.reduce((n, s) => n + s.played, 0);
  const leagueGoals = p ? table.reduce((n, s) => n + s.gf + s.ga, 0) / p : 0;
  const leagueDraws = p ? table.reduce((n, s) => n + s.drawn, 0) / p : 0;
  const goals = them.played ? (them.gf + them.ga) / them.played : 0;
  const draws = them.played ? them.drawn / them.played : 0;
  return { goals: r1(goals), leagueGoals: r1(leagueGoals), draws: r2(draws), leagueDraws: r2(leagueDraws), scored: r1(them.played ? them.gf / them.played : 0), conceded: r1(them.played ? them.ga / them.played : 0) };
}

/** Our record against sides within three places of them, them left out. */
export function againstSidesLike(them: Standing, table: readonly Standing[], results: readonly Result[]) {
  const band = table.filter((s) => !s.is_us && s.team !== them.team && Math.abs(s.position - them.position) <= 3);
  const keys = new Set(band.map((s) => crestKey(s.team)));
  const games = results.filter((r) => keys.has(crestKey(r.opponent)));
  const w = games.filter((g) => g.goals_for > g.goals_against).length;
  const d = games.filter((g) => g.goals_for === g.goals_against).length;
  return {
    from: Math.max(1, them.position - 3),
    to: Math.min(table.length, them.position + 3),
    p: games.length,
    w,
    d,
    l: games.length - w - d,
    gf: games.reduce((n, g) => n + g.goals_for, 0),
    ga: games.reduce((n, g) => n + g.goals_against, 0),
  };
}

/** How we play the game state: results from ahead, level and behind at half time, and goals after it. */
export function gameStates(results: readonly Result[]) {
  const withHt = results.filter((r) => r.ht_for !== null && r.ht_against !== null);
  const tally = (pick: (r: Result) => boolean) => {
    const g = withHt.filter(pick);
    const w = g.filter((r) => r.goals_for > r.goals_against).length;
    const d = g.filter((r) => r.goals_for === r.goals_against).length;
    return { p: g.length, w, d, l: g.length - w - d };
  };
  const goals = withHt.reduce((n, r) => n + r.goals_for, 0);
  const after = withHt.reduce((n, r) => n + (r.goals_for - (r.ht_for ?? 0)), 0);
  const conceded = withHt.reduce((n, r) => n + r.goals_against, 0);
  const concededAfter = withHt.reduce((n, r) => n + (r.goals_against - (r.ht_against ?? 0)), 0);
  return {
    ahead: tally((r) => r.ht_for! > r.ht_against!),
    level: tally((r) => r.ht_for === r.ht_against),
    behind: tally((r) => r.ht_for! < r.ht_against!),
    afterShare: goals ? r2(after / goals) : 0,
    concededAfterShare: conceded ? r2(concededAfter / conceded) : 0,
  };
}

export type ScoutRead = {
  lines: ReturnType<typeof lines>;
  venue: ReturnType<typeof venueRank>;
  trend: ReturnType<typeof trend>;
  profile: ReturnType<typeof profile>;
  sidesLike: ReturnType<typeof againstSidesLike>;
  states: ReturnType<typeof gameStates>;
  points: ReadPoint[];
};

/** The read: the counted numbers the analyst gets, and the patterns that stand out, worded for this fixture. */
export function scoutRead(opts: {
  them: Standing;
  table: readonly Standing[];
  history: readonly Standing[];
  results: readonly Result[];
  odds: MatchOdds;
  venue: "H" | "A";
  competition: string;
  date: string;
  opponent: string;
}): ScoutRead {
  const { them, table, odds } = opts;
  const theirVenue = opts.venue === "H" ? "away" : "home";
  // the earlier table for form: the oldest snapshot two to seven weeks back
  const latest = table[0]?.as_of ?? opts.date;
  const snaps = [...new Set(opts.history.map((s) => s.as_of))].sort();
  const t0 = Date.parse(latest);
  const pick = snaps.find((d) => t0 - Date.parse(d) <= 49 * 86_400_000 && t0 - Date.parse(d) >= 14 * 86_400_000);
  const before = pick ? opts.history.filter((s) => s.as_of === pick) : [];
  const points = findPatterns({ opponent: opts.opponent, venue: opts.venue, competition: opts.competition, date: opts.date, results: opts.results, table, history: opts.history }).map((f) => ({
    key: f.heading,
    line: f.line,
  }));
  return {
    lines: lines(odds),
    venue: venueRank(them, table, theirVenue),
    trend: trend(them, before.find((s) => s.team === them.team)),
    profile: profile(them, table),
    sidesLike: againstSidesLike(them, table, opts.results),
    states: gameStates(opts.results),
    points,
  };
}
