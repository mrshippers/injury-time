import { describe, expect, it } from "vitest";
import snapshot from "../../scripts/belstone-2026-27.json";
import { mapFixturesResults } from "../../src/lib/league/fwp";
import {
  formLetters,
  fromSnapshot,
  goalsByScorer,
  matchPlayer,
  normaliseKickoff,
  ourStanding,
  parseScorer,
  progressFrom,
  type Snapshot,
} from "../../src/lib/league/normalise";

const season = fromSnapshot(snapshot as Snapshot);

describe("kickoff", () => {
  it("turns the feed's clock words into 24h", () => {
    expect(normaliseKickoff("3pm")).toBe("15:00");
    expect(normaliseKickoff("7.45pm")).toBe("19:45");
    expect(normaliseKickoff("11.30am")).toBe("11:30");
    expect(normaliseKickoff("1pm")).toBe("13:00");
    expect(normaliseKickoff("12pm")).toBe("12:00");
    expect(normaliseKickoff("15:00")).toBe("15:00");
    expect(normaliseKickoff("")).toBeNull();
    expect(normaliseKickoff("tbc")).toBeNull();
  });
});

describe("scorers", () => {
  it("reads a surname and a count", () => {
    expect(parseScorer("Mcnally (2, 1 pen)")).toEqual({ name: "Mcnally", goals: 2 });
    expect(parseScorer("Gavin (2)")).toEqual({ name: "Gavin", goals: 2 });
    expect(parseScorer("Joaquim")).toEqual({ name: "Joaquim", goals: 1 });
    expect(parseScorer("Smith (pen)")).toEqual({ name: "Smith", goals: 1 });
    expect(parseScorer("Jones (og)")).toBeNull();
  });
  it("tallies the season from the snapshot", () => {
    const goals = Object.fromEntries(goalsByScorer(season.results).map((g) => [g.name, g.goals]));
    expect(goals.Mcnally).toBe(4);
    expect(goals.Gavin).toBe(4);
    expect(goals.Tomkins).toBe(3);
    expect(goals.Kimber).toBe(2);
    expect(goals.Camara).toBe(2);
    expect(goals.Ocran).toBe(2);
    expect(goals.Joaquim).toBe(2);
    expect(goals.Gilmas).toBe(1);
    expect(goals.Ndukuba).toBe(1);
    const total = Object.values(goals).reduce((a, b) => a + b, 0);
    // every league goal has a name on the feed; the two Vase goals do not
    expect(total).toBe(21);
  });
});

describe("the snapshot as a season", () => {
  it("splits played from still to play", () => {
    expect(season.results).toHaveLength(10);
    expect(season.fixtures).toHaveLength(36);
    expect(season.fixtures[0]).toEqual({ match_date: "2026-09-05", kickoff: "15:00", opponent: "Westside", venue: "H", competition: "Combined Counties Div 1" });
    expect(season.results[0].scorers).toEqual(["Joaquim", "Ocran", "Camara", "Gavin"]);
    expect(season.results[0].ht_for).toBe(1);
  });
  it("reads the table with our row marked", () => {
    expect(season.standings).toHaveLength(22);
    const us = ourStanding(season.standings)!;
    expect(us.team).toBe("Belstone");
    expect(us.position).toBe(6);
    expect([us.played, us.won, us.drawn, us.lost, us.gf, us.ga, us.gd, us.points]).toEqual([9, 6, 0, 3, 21, 9, 12, 18]);
    expect(us.home).toEqual({ p: 4, w: 4, d: 0, l: 0 });
  });
  it("league results alone make the points line, and the table agrees", () => {
    expect(season.progress).toHaveLength(9);
    expect(season.progress[season.progress.length - 1]).toEqual({ match_no: 9, match_date: "2026-09-02", points: 18, position: 6 });
    expect(season.progress.map((p) => p.points)).toEqual([3, 6, 6, 9, 12, 12, 12, 15, 18]);
    expect(progressFrom([], null)).toEqual([]);
  });
  it("carries appearances and form", () => {
    expect(season.appearances).toHaveLength(20);
    expect(season.appearances[0]).toEqual({ name: "Daniel Flynn", apps: 9 });
    expect(formLetters(season.results)).toEqual(["W", "W", "L", "L", "W", "W"]);
  });
});

describe("matching feed names to players", () => {
  const players = [{ name: "Jordan Mcnally" }, { name: "James Kimber" }, { name: "Jack Kimber" }, { name: "Hodje Joaquim" }];
  it("matches a surname when exactly one player carries it", () => {
    expect(matchPlayer("Mcnally", players)?.name).toBe("Jordan Mcnally");
    expect(matchPlayer("Jordan Mcnally", players)?.name).toBe("Jordan Mcnally");
    expect(matchPlayer("joaquim", players)?.name).toBe("Hodje Joaquim");
  });
  it("refuses to guess between two Kimbers", () => {
    expect(matchPlayer("Kimber", players)).toBeNull();
    expect(matchPlayer("Nobody", players)).toBeNull();
  });
});

describe("the api mapper", () => {
  it("skips what it cannot read and never invents a score", () => {
    const body = {
      "fixtures-results": {
        matches: [
          { date: "2026-09-05", time: "3pm", "home-team": { name: "Belstone" }, "away-team": { name: "Westside" }, competition: { name: "Combined Counties Div 1" } },
          { date: "2026-08-29", "home-team": { name: "Belstone", score: 3 }, "away-team": { name: "Spelthorne Sports", score: 1 }, competition: { name: "Combined Counties Div 1" }, attendance: 67 },
          { "home-team": { name: "x" } },
        ],
      },
    };
    const { results, fixtures } = mapFixturesResults(body, "Belstone");
    expect(fixtures).toEqual([{ match_date: "2026-09-05", kickoff: "15:00", opponent: "Westside", venue: "H", competition: "Combined Counties Div 1" }]);
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ opponent: "Spelthorne Sports", venue: "H", goals_for: 3, goals_against: 1, attendance: 67, source: "fwp" });
  });
});
