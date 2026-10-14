import { describe, expect, it } from "vitest";

import { cupRuns, lastResult, roundLabel, splitCompetition } from "@/lib/home/cups";
import type { Fixture, Result } from "@/lib/types";

const res = (match_date: string, competition: string, opponent: string, gf: number, ga: number, venue: "H" | "A" = "H") =>
  ({ match_date, competition, opponent, goals_for: gf, goals_against: ga, venue }) as Result;
const fix = (match_date: string, competition: string, opponent: string, venue: "H" | "A" = "H") =>
  ({ match_date, competition, opponent, venue, kickoff: "15:00" }) as Fixture;

describe("splitCompetition", () => {
  it("takes the trailing round token off the competition name", () => {
    expect(splitCompetition("FA Vase 1Q")).toEqual({ name: "FA Vase", token: "1Q" });
    expect(splitCompetition("FA Vase 1")).toEqual({ name: "FA Vase", token: "1" });
    expect(splitCompetition("CCL Div One Challenge Cup 2")).toEqual({ name: "CCL Div One Challenge Cup", token: "2" });
    expect(splitCompetition("Herts Cup")).toEqual({ name: "Herts Cup", token: null });
  });
  it("words the rounds the way a club says them", () => {
    expect(roundLabel("1Q")).toBe("1st qualifying round");
    expect(roundLabel("2")).toBe("round 2");
    expect(roundLabel(null)).toBe("tie");
  });
});

describe("cupRuns", () => {
  const results = [
    res("2026-08-14", "FA Vase 1Q", "Enfield", 2, 0, "A"),
    res("2026-09-12", "FA Vase 2Q", "Wivenhoe Town", 3, 1),
    res("2026-10-10", "FA Vase 1", "Baldock Town", 4, 2),
    res("2026-10-03", "Combined Counties Div 1", "Woodley United", 1, 4, "A"),
    res("2026-10-06", "CCL Div One Challenge Cup 1", "Bovingdon", 6, 1),
  ];
  const fixtures = [fix("2026-10-31", "FA Vase 2", "Wisbech Town"), fix("2026-11-17", "CCL Div One Challenge Cup 2", "Oxhey Jets", "A"), fix("2026-10-17", "Combined Counties Div 1", "Staines & Lammas", "A")];

  it("builds one run per cup, league games never appear", () => {
    const runs = cupRuns(results, fixtures, "2026-10-14");
    expect(runs.map((r) => r.name).sort()).toEqual(["CCL Div One Challenge Cup", "FA Vase"]);
    const vase = runs.find((r) => r.name === "FA Vase")!;
    expect(vase.ties.map((t) => `${t.round}:${t.score ?? "next"}`)).toEqual(["1st qualifying round:2-0", "2nd qualifying round:3-1", "round 1:4-2", "round 2:next"]);
    expect(vase.state).toBe("in");
    expect(vase.line).toBe("through, at home to Wisbech Town in round 2");
  });

  it("a cup lost with nothing after it is out", () => {
    const runs = cupRuns([res("2026-09-26", "Herts Cup 1", "X", 0, 2)], [], "2026-10-14");
    expect(runs[0].state).toBe("out");
    expect(runs[0].line).toContain("out in round 1");
  });

  it("a win with nothing in the diary is waiting on the draw, not out", () => {
    const runs = cupRuns([res("2026-09-26", "Herts Cup 1", "X", 6, 1)], [], "2026-10-14");
    expect(runs[0].state).toBe("waiting");
  });

  it("a past fixture row is not a next tie", () => {
    const runs = cupRuns([], [fix("2026-10-10", "FA Vase 1", "Baldock Town")], "2026-10-14");
    expect(runs).toEqual([]);
  });
});

describe("lastResult", () => {
  it("is the latest game in any competition, cup included", () => {
    const r = lastResult([res("2026-10-03", "Combined Counties Div 1", "A", 1, 4), res("2026-10-10", "FA Vase 1", "Baldock Town", 4, 2)]);
    expect(r?.opponent).toBe("Baldock Town");
  });
  it("is null with no games", () => expect(lastResult([])).toBeNull());
});
