import { describe, expect, it } from "vitest";
import snapshot from "../../scripts/belstone-2026-27.json";
import { fromSnapshot, type Snapshot } from "../../src/lib/league/normalise";
import { goalGames, milestones, moments, scoringRun, strikeRate } from "../../src/lib/hub/hub";
import type { Clip, Result } from "../../src/lib/types";

const season = fromSnapshot(snapshot as Snapshot);
const results = season.results.map((r, i) => ({ ...r, id: `r${i}`, club_id: "c", created_at: "" })) as Result[];
const roster = season.appearances.map((a, i) => ({ id: `p${i}`, name: a.name }));
const idOf = (name: string) => roster.find((p) => p.name === name)!.id;
const fmt = (d: string) => d;
const stats = (apps: number, goals: number) => ({ apps, starts: 0, minutes: 0, goals, assists: 0, yellow: 0, red: 0, source: "feed" as const });

describe("the hub, off the league's scorer lists", () => {
  it("finds every game a player scored in, and counts the brace and the hat-trick", () => {
    const thomaj = goalGames(idOf("Kushan Thomaj"), roster, results, []);
    expect(thomaj.map((g) => [g.date, g.goals])).toEqual([["2026-09-15", 1], ["2026-09-22", 3], ["2026-09-26", 1]]);
    expect(thomaj[1]).toMatchObject({ opponent: "Maidenhead Town", score: "5-1", venue: "H" });
  });
  it("never hands a shared surname to either brother", () => {
    // "Kimber" on the sheet is James or Jack: the feed cannot say which
    expect(goalGames(idOf("James Kimber"), roster, results, [])).toEqual([]);
    expect(goalGames(idOf("Jack Kimber"), roster, results, [])).toEqual([]);
  });
  it("claims only what the rows prove", () => {
    const games = goalGames(idOf("Kushan Thomaj"), roster, results, []);
    const run = scoringRun(games, results.map((r) => r.match_date));
    expect(run).toBe(2); // 22 sep, 26 sep; bovingdon on 19 sep breaks it
    const { won, next } = milestones(games, stats(5, 5), run, fmt);
    expect(won.map((m) => m.title)).toEqual(["first goal of the season", "hat-trick", "scored in two running", "5 goals"]);
    expect(won[1].detail).toBe("v Maidenhead Town, 2026-09-22, won 5-1");
    expect(next).toEqual([{ title: "10 appearances", left: 5 }, { title: "double figures", left: 5 }]);
  });
  it("a player with no goals gets no goal milestones and no strike rate", () => {
    const games = goalGames(idOf("Daniel Flynn"), roster, results, []);
    expect(games).toEqual([]);
    const { won } = milestones(games, stats(15, 0), 0, fmt);
    expect(won.map((m) => m.title)).toEqual(["10 appearances"]);
    expect(strikeRate(stats(15, 0))).toBeNull();
  });
});

describe("the hub, off the club's own logging", () => {
  it("prefers the logged matches and joins the score by date", () => {
    const games = goalGames("x", roster, results, [
      { date: "2026-09-22", opponent: "Maidenhead Town", minutes: 90, goals: 2, assists: 1 },
      { date: "2026-10-03", opponent: "Woodley United", minutes: 70, goals: 0, assists: 0 },
    ]);
    expect(games).toEqual([{ date: "2026-09-22", opponent: "Maidenhead Town", competition: "Combined Counties Div 1", venue: "H", goals: 2, score: "5-1" }]);
  });
  it("says a strike rate once there are five games", () => {
    expect(strikeRate(stats(4, 4))).toBeNull();
    expect(strikeRate(stats(10, 5))).toBe("one every 2 games");
    expect(strikeRate(stats(6, 9))).toBe("1.5 a game");
    expect(strikeRate(stats(5, 5))).toBe("a goal a game");
  });
});

describe("moments", () => {
  it("keeps the football and leaves injuries and staff notes off the page", () => {
    const clip = { id: "c1", title: "v Westside", opponent: "Westside", match_date: "2026-09-05", events: [
      { t: 312, kind: "goal", player_id: "p1" },
      { t: 400, kind: "injury", player_id: "p1" },
      { t: 500, kind: "note", player_id: "p1", note: "staff only" },
      { t: 90, kind: "save", player_id: "p2" },
    ] } as unknown as Clip;
    expect(moments("p1", [clip]).map((m) => [m.kind, m.t])).toEqual([["goal", 312]]);
  });
});
