import { describe, expect, it } from "vitest";

import { recordLine, recordOf, seasonByCompetition } from "@/lib/home/competitions";
import { isLeague } from "@/lib/home/season-context";
import type { Fixture, Result, Standing } from "@/lib/types";

const res = (match_date: string, competition: string, opponent: string, gf: number, ga: number, venue: "H" | "A" = "H") =>
  ({ match_date, competition, opponent, goals_for: gf, goals_against: ga, venue }) as Result;
const fix = (match_date: string, competition: string, opponent: string, venue: "H" | "A" = "H") =>
  ({ match_date, competition, opponent, venue, kickoff: "15:00" }) as Fixture;

const results = [
  res("2026-08-14", "FA Vase 1Q", "Enfield", 2, 0, "A"),
  res("2026-08-21", "Combined Counties Div 1", "Woodley United", 1, 4, "A"),
  res("2026-08-28", "Combined Counties Div 1", "Baldock Town", 2, 2),
  res("2026-09-12", "FA Vase 2Q", "Wivenhoe Town", 1, 3),
  res("2026-09-19", "Herts Charity Cup 1", "Hoddesdon", 3, 0),
  res("2026-09-26", "Combined Counties Div 1", "Enfield", 2, 1),
];
const fixtures = [fix("2026-10-03", "Herts Charity Cup 2", "Ware", "A"), fix("2026-10-10", "Combined Counties Div 1", "Tring", "H")];
const standings = [
  { position: 1, team: "Tring", played: 3, won: 3, drawn: 0, lost: 0, gf: 9, ga: 1, gd: 8, points: 9, is_us: false },
  { position: 7, team: "Us", played: 3, won: 1, drawn: 1, lost: 1, gf: 5, ga: 7, gd: -2, points: 4, is_us: true },
] as Standing[];

describe("isLeague is one reading across the app", () => {
  it("treats a charity cup as a cup and a league with 'cup' inside a word as league", () => {
    expect(isLeague("Herts Charity Cup 1")).toBe(false);
    expect(isLeague("Buttercup League Div 1")).toBe(true);
    expect(isLeague("FA Vase 1Q")).toBe(false);
  });
});

describe("seasonByCompetition", () => {
  const s = seasonByCompetition({ results, fixtures, standings, asOf: "2026-09-27" });

  it("reads the league from the table when there is one", () => {
    expect(s.league.record).toMatchObject({ played: 3, won: 1, drawn: 1, lost: 1, points: 4 });
    expect(s.league.position).toBe(7);
    expect(s.league.teams).toBe(2);
    expect(s.league.next?.opponent).toBe("Tring");
  });

  it("falls back to results when there is no table yet", () => {
    const t = seasonByCompetition({ results, fixtures, standings: [], asOf: "2026-09-27" });
    expect(t.league.record).toMatchObject({ played: 3, won: 1, drawn: 1, lost: 1, points: 4, gf: 5, ga: 7 });
    expect(t.league.position).toBeNull();
  });

  it("gives each cup its run and its record, the live one first", () => {
    expect(s.cups.map((c) => c.name)).toEqual(["Herts Charity Cup", "FA Vase"]);
    expect(s.cups[0]).toMatchObject({ state: "in", record: { played: 1, won: 1, points: 3 } });
    expect(s.cups[1]).toMatchObject({ state: "out", record: { played: 2, won: 1, lost: 1 } });
    expect(s.count).toBe(3);
  });

  it("words a record", () => {
    expect(recordLine(recordOf([res("d", "x", "o", 2, 0), res("d", "x", "o", 1, 1)]))).toBe("1w 1d 0l · 3:1");
  });
});
