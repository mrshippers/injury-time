import { describe, expect, it } from "vitest";

import { findPatterns, parseScorer } from "@/lib/scout/patterns";
import type { Result, Standing } from "@/lib/types";

const res = (d: string, opponent: string, venue: "H" | "A", gf: number, ga: number, hf: number, ha: number, scorers: string[] = [], competition = "Combined Counties Div 1"): Result =>
  ({ id: d + opponent, club_id: "c", match_date: d, competition, opponent, venue, goals_for: gf, goals_against: ga, ht_for: hf, ht_against: ha, attendance: null, scorers, source: "t", created_at: "" }) as Result;
const row = (team: string, position: number, o: Partial<Standing> = {}): Standing =>
  ({ id: team, club_id: "c", as_of: "2026-10-10", position, team, played: 10, won: 4, drawn: 2, lost: 4, gf: 15, ga: 15, gd: 0, points: 14, home: { p: 5, w: 2, d: 1, l: 2 }, away: { p: 5, w: 2, d: 1, l: 2 }, is_us: false, ...o }) as Standing;

const table = [row("Us", 2, { is_us: true }), row("Rivals", 5), ...Array.from({ length: 8 }, (_, i) => row(`T${i}`, i < 1 ? 1 : i + 3))];
const results = [
  res("2026-08-01", "T0", "H", 2, 0, 1, 0, ["Mcnally (2, 1 pen)"]),
  res("2026-08-08", "T1", "A", 0, 1, 0, 1),
  res("2026-08-15", "T2", "H", 3, 1, 2, 0, ["McNally", "Gavin (2)"]),
  res("2026-08-22", "T3", "A", 2, 2, 0, 2, ["Gavin", "Park"]),
  res("2026-08-29", "T4", "H", 1, 0, 1, 0, ["McNally"]),
  res("2026-09-05", "Rivals", "A", 1, 3, 0, 1, ["McNally"]),
  res("2026-09-12", "T5", "H", 4, 1, 3, 0, ["Gavin"]),
  res("2026-09-19", "T6", "A", 2, 1, 0, 1, ["Park", "McNally"]),
  res("2026-09-26", "T7", "H", 2, 0, 2, 0, ["Gavin", "McNally"]),
];
const ctx = (opponent = "Rivals", venue: "H" | "A" = "H") => ({ opponent, venue, competition: "Combined Counties Div 1", date: "2026-10-17", results, table, history: table });

describe("patterns", () => {
  it("reads a scorer, folding case", () => {
    expect(parseScorer("Mcnally (2, 1 pen)")).toMatchObject({ key: "mcnally", goals: 2 });
    expect(parseScorer("McNally").key).toBe("mcnally");
  });
  it("head to head comes first and tells the story of the last meeting", () => {
    const f = findPatterns(ctx());
    expect(f[0].about).toBe("h2h");
    expect(f[0].line).toMatch(/1-3/);
    expect(f[0].line).toMatch(/at home|away/);
  });
  it("half-time leads held and comebacks counted, in plain words", () => {
    const f = findPatterns(ctx("T9"));
    const leads = f.find((x) => x.key === "leads");
    expect(leads?.line).toMatch(/5/);
    const cb = f.find((x) => x.key === "comebacks");
    expect(cb?.line).toMatch(/come from behind/i);
  });
  it("every line carries a number or a rank, and wording changes with the fixture", () => {
    const a = findPatterns(ctx("T9", "A"));
    for (const x of a) expect(x.line).toMatch(/\d|league/);
    const lines = new Set<string>();
    for (const opp of ["T9", "T8", "Rivals", "T5", "T6", "T7"]) for (const x of findPatterns(ctx(opp))) if (x.key === "leads") lines.add(x.line);
    expect(lines.size).toBeGreaterThan(1);
  });
  it("holds back small samples", () => {
    const few = findPatterns({ ...ctx("T9"), results: results.slice(0, 2) });
    expect(few.find((x) => x.key === "leads")).toBeUndefined();
    expect(few.find((x) => x.key === "rest")).toBeUndefined();
  });
});
