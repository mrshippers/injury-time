import { describe, expect, it } from "vitest";

import { findCongestion, type CongestionPlayer } from "../../src/lib/home/congestion";

const fx = (match_date: string, opponent: string) => ({ match_date, opponent, venue: "H" as const });
const p = (id: string, readiness: CongestionPlayer["readiness"], available = true): CongestionPlayer => ({ id, name: `P${id}`, readiness, word: readiness, available });
const squad = [p("1", "red"), p("2", "pushing"), p("3", "steady"), p("4", "steady"), p("5", "undercooked"), p("6", "red", false)];

describe("fixture pile-up", () => {
  it("finds Saturday then Tuesday and names who to rotate, red zone first", () => {
    const c = findCongestion([fx("2026-10-03", "A"), fx("2026-10-06", "B"), fx("2026-10-17", "C")], squad, "2026-09-29");
    expect(c).toMatchObject({ first: { opponent: "A" }, second: { opponent: "B" }, gap: 3, judged: true });
    expect(c!.rotate.map((r) => r.id)).toEqual(["1", "2"]);
  });
  it("leaves out a player who is not available anyway", () => {
    const c = findCongestion([fx("2026-10-03", "A"), fx("2026-10-05", "B")], squad, "2026-09-29");
    expect(c!.rotate.map((r) => r.id)).not.toContain("6");
  });
  it("is quiet when the games are a week apart", () => {
    expect(findCongestion([fx("2026-10-03", "A"), fx("2026-10-10", "B")], squad, "2026-09-29")).toBeNull();
  });
  it("ignores pile-ups past the horizon and games already played", () => {
    expect(findCongestion([fx("2026-09-20", "X"), fx("2026-09-22", "Y"), fx("2026-11-01", "A"), fx("2026-11-03", "B")], squad, "2026-09-29")).toBeNull();
  });
  it("says it could not judge when nobody has a load reading", () => {
    const c = findCongestion([fx("2026-10-03", "A"), fx("2026-10-04", "B")], [p("1", "unknown"), p("2", "unknown")], "2026-09-29");
    expect(c).toMatchObject({ judged: false, rotate: [] });
  });
});
