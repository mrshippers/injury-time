import { describe, expect, it } from "vitest";

import { parseResultInput } from "../../src/lib/club/result-input";

const base = { matchDate: "2026-09-27", opponent: "Tring Athletic", venue: "a", competition: "", goalsFor: "2", goalsAgainst: 1, scorers: "Ashworth, Lindqvist" };

describe("a result the club enters", () => {
  it("takes a played match and defaults the competition to the league", () => {
    const r = parseResultInput(base, "2026-09-28");
    expect(r.ok && r.result).toMatchObject({ venue: "A", goals_for: 2, goals_against: 1, competition: "League", scorers: ["Ashworth", "Lindqvist"], source: "manual" });
  });
  it("refuses a match that has not been played", () => {
    expect(parseResultInput({ ...base, matchDate: "2026-10-04" }, "2026-09-28")).toEqual({ ok: false, error: "that match has not been played yet" });
  });
  it("refuses more named goals than were scored, counting a brace", () => {
    expect(parseResultInput({ ...base, scorers: "Ashworth 2, Lindqvist" }, "2026-09-28")).toEqual({ ok: false, error: "3 goals named, 2 scored" });
  });
  it("refuses a score that is not one", () => {
    expect(parseResultInput({ ...base, goalsFor: "two" }, "2026-09-28").ok).toBe(false);
    expect(parseResultInput({ ...base, goalsAgainst: -1 }, "2026-09-28").ok).toBe(false);
  });
  it("needs an opposition and a venue", () => {
    expect(parseResultInput({ ...base, opponent: " " }, "2026-09-28").ok).toBe(false);
    expect(parseResultInput({ ...base, venue: "N" }, "2026-09-28").ok).toBe(false);
  });
});
