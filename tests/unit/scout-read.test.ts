import { describe, expect, it } from "vitest";

import { againstSidesLike, gameStates, lines, profile, scoutRead, trend, venueRank } from "@/lib/scout/read";
import type { Result, Standing } from "@/lib/types";

const row = (team: string, position: number, o: Partial<Standing> = {}): Standing =>
  ({ id: team, club_id: "c", as_of: "2026-10-10", position, team, played: 10, won: 4, drawn: 2, lost: 4, gf: 15, ga: 15, gd: 0, points: 14, home: { p: 5, w: 2, d: 1, l: 2 }, away: { p: 5, w: 2, d: 1, l: 2 }, is_us: false, ...o }) as Standing;
const res = (opponent: string, gf: number, ga: number, htf: number | null, hta: number | null): Result =>
  ({ id: opponent + gf + ga, club_id: "c", match_date: "2026-09-01", competition: "league", opponent, venue: "H", goals_for: gf, goals_against: ga, ht_for: htf, ht_against: hta, attendance: null, scorers: [], source: "t", created_at: "" }) as Result;

describe("the read", () => {
  const table = [row("Us", 1, { is_us: true }), row("A", 2), row("B", 3, { home: { p: 5, w: 0, d: 1, l: 4 } }), row("C", 4), row("D", 5), row("E", 9)];
  const results = [res("A", 2, 1, 0, 1), res("C", 1, 1, 1, 1), res("D", 3, 0, 1, 0), res("E", 0, 2, 0, 1)];

  it("lines come from the two scoring rates and stay probabilities", () => {
    const l = lines({ xgFor: 1.5, xgAgainst: 1.5 });
    expect(l.btts).toBeCloseTo(0.6, 1);
    expect(l.ourCleanSheet).toBeCloseTo(0.22, 2);
    expect(l.over25).toBeGreaterThan(0.5);
  });
  it("ranks their venue record against the league", () => {
    const v = venueRank(table[2], table, "home");
    expect(v).toMatchObject({ w: 0, d: 1, l: 4, rank: 6, of: 6 });
  });
  it("form is points since the earlier table", () => {
    expect(trend(row("B", 3, { played: 10, points: 14 }), row("B", 6, { played: 6, points: 5 }))).toMatchObject({ games: 4, points: 9, recent: 2.25, moved: 3 });
    expect(trend(row("B", 3), undefined)).toBeNull();
  });
  it("sides like them: within three places, them and us left out", () => {
    const sl = againstSidesLike(table[2], table, results);
    expect(sl).toMatchObject({ p: 3, w: 2, d: 1, l: 0, gf: 6, ga: 2 });
  });
  it("game states from half time", () => {
    const st = gameStates(results);
    expect(st.behind).toMatchObject({ p: 2, w: 1, l: 1 });
    expect(st.level).toMatchObject({ p: 1, d: 1 });
    expect(st.afterShare).toBeCloseTo(4 / 6, 2);
  });
  it("profile against the league, and the points carry numbers", () => {
    expect(profile(table[2], table).goals).toBe(3);
    const r = scoutRead({ them: table[2], table, history: table, results, odds: { xgFor: 1.4, xgAgainst: 1.1, win: 0.45, draw: 0.27, loss: 0.28, scorelines: [] }, venue: "A", competition: "league", date: "2026-10-17", opponent: "B" });
    expect(r.points.length).toBeGreaterThanOrEqual(2);
    for (const p of r.points) expect(p.line).toMatch(/\d|league/);
  });
});
