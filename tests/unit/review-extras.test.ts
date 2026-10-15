import { describe, expect, it } from "vitest";

import snapshot from "../fixtures/belstone-2026-09-26.json";
import liveSnapshot from "../../scripts/belstone-2026-27.json";
import { fromSnapshot, type Snapshot } from "../../src/lib/league/normalise";
import { halfTimeSwings, reviewSentences, cleanSheets, cupsOnly, extremes, halves, homeCrowds, leagueOnly, monthly, recordOf, runsOf, scorerRows, venueSplit, type ReviewGame } from "../../src/lib/review/extras";

const g = (match_date: string, competition: string, venue: "H" | "A", gf: number, ga: number, extra: Partial<ReviewGame> = {}): ReviewGame => ({
  match_date, competition, opponent: "X", venue, goals_for: gf, goals_against: ga, ht_for: null, ht_against: null, attendance: null, scorers: [], ...extra,
});

describe("record, split and clean sheets", () => {
  const games = [g("2026-08-01", "League", "H", 2, 0), g("2026-08-08", "League", "A", 0, 1), g("2026-08-15", "FA Vase 1Q", "A", 2, 0), g("2026-08-22", "League", "H", 1, 1)];
  it("counts a record", () => expect(recordOf(games)).toEqual({ played: 4, won: 2, drawn: 1, lost: 1, gf: 5, ga: 2, points: 7 }));
  it("keeps the cups out of the league and the league out of the cups", () => {
    expect(leagueOnly(games)).toHaveLength(3);
    expect(cupsOnly(games).map((x) => x.competition)).toEqual(["FA Vase 1Q"]);
  });
  it("splits home from away", () => {
    const s = venueSplit(leagueOnly(games));
    expect([s.home.played, s.home.points, s.away.played, s.away.points]).toEqual([2, 4, 1, 0]);
  });
  it("counts clean sheets and blanks", () => expect(cleanSheets(games)).toEqual({ kept: 2, failedToScore: 1 }));
});

describe("goals by half", () => {
  it("counts only games that have a half-time score, and says how many", () => {
    const h = halves([g("a", "L", "H", 3, 1, { ht_for: 1, ht_against: 1 }), g("b", "L", "H", 2, 0), g("c", "L", "H", 0, 2, { ht_for: 0, ht_against: 2 })]);
    expect(h).toEqual({ counted: 2, scoredFirst: 1, scoredSecond: 2, concededFirst: 3, concededSecond: 0 });
  });
});

describe("extremes, crowds, months, runs", () => {
  it("finds the biggest win and the heaviest defeat", () => {
    const e = extremes([g("a", "L", "H", 6, 0), g("b", "L", "A", 2, 5), g("c", "L", "A", 1, 4), g("d", "L", "H", 1, 1)]);
    expect(e.biggestWin?.goals_for).toBe(6);
    expect(e.heaviestDefeat?.goals_against).toBe(5);
  });
  it("no win, no biggest win", () => expect(extremes([g("a", "L", "H", 0, 1)]).biggestWin).toBeNull());
  it("averages home crowds only, and counts the games it could", () => {
    const c = homeCrowds([g("a", "L", "H", 1, 0, { attendance: 50 }), g("b", "L", "A", 1, 0, { attendance: 900 }), g("c", "L", "H", 1, 0, { attendance: 100 }), g("d", "L", "H", 1, 0)]);
    expect(c).toMatchObject({ counted: 2, average: 75 });
    expect(c.best?.attendance).toBe(100);
    expect(c.lowest?.attendance).toBe(50);
  });
  it("points a game by month", () => {
    const m = monthly([g("2026-08-01", "L", "H", 1, 0), g("2026-08-08", "L", "H", 0, 0), g("2026-09-01", "L", "H", 0, 3)]);
    expect(m).toEqual([{ key: "2026-08", label: "Aug", played: 2, points: 4, ppg: 2 }, { key: "2026-09", label: "Sep", played: 1, points: 0, ppg: 0 }]);
  });
  it("runs: longest unbeaten, winless and winning, and where it stands now", () => {
    const r = runsOf([g("1", "L", "H", 1, 0), g("2", "L", "H", 2, 0), g("3", "L", "H", 0, 0), g("4", "L", "H", 0, 1), g("5", "L", "H", 0, 0)]);
    expect(r).toMatchObject({ unbeaten: 3, winning: 2, winless: 3, current: { kind: "unbeaten", games: 1 } });
  });
  it("no games, no current run", () => expect(runsOf([]).current).toBeNull());
});

describe("scorerRows", () => {
  const resolve = (n: string) => (n.toLowerCase() === "mcnally" ? { name: "Jordan Mcnally", apps: 12 } : null);
  it("is case-blind, counts braces and hat-tricks once per game, and leaves own goals out", () => {
    const rows = scorerRows(
      [g("1", "L", "H", 3, 0, { scorers: ["Mcnally (2, 1 pen)", "Gavin"] }), g("2", "L", "H", 1, 0, { scorers: ["McNally"] }), g("3", "L", "H", 5, 0, { scorers: ["Gavin (3)", "Jones (og)"] })],
      resolve,
    );
    const m = rows.find((r) => r.name === "Jordan Mcnally")!;
    expect(m).toMatchObject({ goals: 3, braces: 1, hatTricks: 0, apps: 12, perGame: 0.25 });
    const gv = rows.find((r) => r.name === "Gavin")!;
    expect(gv).toMatchObject({ goals: 4, hatTricks: 1, apps: null, perGame: null });
    expect(rows.some((r) => r.name === "Jones")).toBe(false);
  });
});

describe("on the real snapshots", () => {
  const live = fromSnapshot(liveSnapshot as Snapshot);
  const old = fromSnapshot(snapshot as Snapshot);
  const asGames = (s: typeof live) => s.results.map((r) => ({ ...r, venue: r.venue as "H" | "A" })) as ReviewGame[];
  it("the live season: 20 played, league 15 and cups 5, unbeaten at home in the league", () => {
    const all = asGames(live);
    expect(all).toHaveLength(20);
    expect(leagueOnly(all)).toHaveLength(15);
    expect(cupsOnly(all)).toHaveLength(5);
    expect(recordOf(cupsOnly(all))).toMatchObject({ played: 5, won: 5, lost: 0 });
    const split = venueSplit(leagueOnly(all));
    expect(split.home.lost).toBe(0);
    expect(split.away.lost).toBe(4);
  });
  it("league points from the sheets equal the league table's points", () => {
    expect(recordOf(leagueOnly(asGames(live))).points).toBe(27);
    expect(recordOf(leagueOnly(asGames(old))).points).toBe(27);
  });
});

describe("reviewSentences", () => {
  const rec = (won: number, drawn: number, lost: number) => ({ played: won + drawn + lost, won, drawn, lost, gf: 0, ga: 0, points: won * 3 + drawn });
  it("says the venue split, the cups and the clean sheets, in words", () => {
    const s = reviewSentences({ split: { home: rec(6, 1, 0), away: rec(2, 2, 4) }, cups: rec(5, 0, 0), cupsStillIn: ["FA Vase", "CCL Div One Challenge Cup"], cleanSheets: 4, leaguePlayed: 15 });
    expect(s).toEqual([
      "Unbeaten at home in the league: six wins and a draw from seven; two wins from eight away.",
      "In the cups: five wins from five. Still in the FA Vase and the CCL Div One Challenge Cup.",
      "Four clean sheets in fifteen league games.",
    ]);
  });
  it("drops what it cannot say", () => {
    expect(reviewSentences({ split: { home: rec(0, 0, 0), away: rec(0, 0, 0) }, cups: rec(0, 0, 0), cupsStillIn: [], cleanSheets: 0, leaguePlayed: 0 })).toEqual([]);
  });
});

describe("halfTimeSwings", () => {
  it("counts points won from behind and dropped from ahead, over games with a half-time score only", () => {
    const s = halfTimeSwings([
      g("1", "L", "H", 2, 1, { ht_for: 0, ht_against: 1 }), // behind, won: +3
      g("2", "L", "H", 1, 1, { ht_for: 0, ht_against: 1 }), // behind, drew: +1
      g("3", "L", "H", 1, 1, { ht_for: 1, ht_against: 0 }), // ahead, drew: -2
      g("4", "L", "H", 1, 2, { ht_for: 1, ht_against: 0 }), // ahead, lost: -3
      g("5", "L", "H", 3, 0, { ht_for: 2, ht_against: 0 }), // ahead, won: 0
      g("6", "L", "H", 0, 4), // no half-time score
    ]);
    expect(s).toEqual({ counted: 5, behindAtHt: 2, wonFromBehind: 4, aheadAtHt: 3, droppedFromAhead: 5 });
  });
});
