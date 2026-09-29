import { describe, expect, it } from "vitest";

import type { LoadEntry } from "../../src/lib/load-engine";
import { seasonReview, seasonWindow, type ReviewInjury } from "../../src/lib/review/season";

const res = (d: string, gf: number, ga: number, competition = "League") => ({ match_date: d, competition, goals_for: gf, goals_against: ga });
const inj = (id: string, player_id: string, occurred_on: string, resolved_on: string | null = null): ReviewInjury => ({ id, player_id, body_region: "hamstring", severity: "minor", occurred_on, resolved_on });

// 5 weeks of steady load, then a huge spike in the final week before 2026-09-20
function spikeLoads(): LoadEntry[] {
  const out: LoadEntry[] = [];
  for (let d = 0; d < 35; d++) {
    const date = new Date(Date.parse("2026-08-12") + d * 86_400_000).toISOString().slice(0, 10);
    if (d % 3 === 0) out.push({ date, load: d >= 29 ? 2400 : 300 });
  }
  return out;
}

describe("season review", () => {
  it("counts the league record and leaves cup games out", () => {
    const r = seasonReview([res("2026-08-16", 2, 0), res("2026-08-23", 1, 1), res("2026-08-30", 0, 3), res("2026-09-02", 5, 0, "FA Vase")], [], new Map(), "2026-09-28");
    expect(r.record).toEqual({ played: 3, won: 1, drawn: 1, lost: 1, gf: 3, ga: 4, points: 4 });
  });
  it("adds up days lost, ongoing injuries to today", () => {
    const r = seasonReview([], [inj("a", "p1", "2026-09-01", "2026-09-11"), inj("b", "p2", "2026-09-20")], new Map(), "2026-09-28");
    expect(r.injuries).toMatchObject({ count: 2, ongoing: 1, daysLost: 18 });
  });
  it("credits the red zone only when a reading existed, and never judges a logging gap", () => {
    const r = seasonReview([], [inj("a", "spiked", "2026-09-16"), inj("b", "unlogged", "2026-09-16")], new Map([["spiked", spikeLoads()]]), "2026-09-28");
    expect(r.before.find((b) => b.playerId === "unlogged")!.flag).toBe("cold");
    expect(r.before.find((b) => b.playerId === "spiked")!.flag).toBe("red");
    expect(r).toMatchObject({ redCalled: 1, judged: 1 });
  });
});

describe("the season window", () => {
  it("reads 2026-27 as July to June", () => {
    expect(seasonWindow("2026-27", "2026-09-29")).toEqual({ from: "2026-07-01", to: "2027-06-30" });
  });
  it("falls back to the last year when no season is set", () => {
    expect(seasonWindow(null, "2026-09-29")).toEqual({ from: "2025-09-29", to: "2026-09-29" });
  });
});
