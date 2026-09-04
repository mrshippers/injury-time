import { describe, expect, it } from "vitest";
import snapshot from "../../scripts/belstone-2026-27.json";
import { christmasFor, isLeague, ordinal, seasonContext, word } from "../../src/lib/home/season-context";
import type { Fixture, Result, Standing } from "../../src/lib/types";

type Raw = {
  date: string;
  venue: "H" | "A";
  opponent: string;
  competition: string;
  goals_for?: number;
  goals_against?: number;
  attendance?: number | null;
  scorers?: string[];
  kickoff?: string;
};

const raw = snapshot.fixtures as Raw[];
const results: Result[] = raw
  .filter((f) => f.goals_for !== undefined)
  .map((f, i) => ({
    id: `r${i}`,
    club_id: "c",
    match_date: f.date,
    competition: f.competition,
    opponent: f.opponent,
    venue: f.venue,
    goals_for: f.goals_for!,
    goals_against: f.goals_against!,
    ht_for: null,
    ht_against: null,
    attendance: f.attendance ?? null,
    scorers: f.scorers ?? [],
    source: "snapshot",
    created_at: "",
  }));
const fixtures: Fixture[] = raw
  .filter((f) => f.goals_for === undefined)
  .map((f, i) => ({
    id: `f${i}`,
    club_id: "c",
    match_date: f.date,
    kickoff: f.kickoff ?? null,
    opponent: f.opponent,
    venue: f.venue,
    competition: f.competition,
    created_at: "",
  }));
const standings: Standing[] = (snapshot.table as { position: number; team: string; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; points: number }[]).map((t) => ({
  id: `s${t.position}`,
  club_id: "c",
  as_of: "2026-09-02",
  position: t.position,
  team: t.team,
  played: t.played,
  won: t.won,
  drawn: t.drawn,
  lost: t.lost,
  gf: t.gf,
  ga: t.ga,
  gd: t.gd,
  points: t.points,
  home: {},
  away: {},
  is_us: t.team === "Belstone",
}));

describe("season context, belstone 2026-27 after 2 sep", () => {
  const ctx = seasonContext({ results, standings, progress: [], fixtures, asOf: "2026-09-03" });

  it("reads the table row, not the results, when the table is there", () => {
    expect(ctx.played).toBe(9);
    expect(ctx.points).toBe(18);
    expect(ctx.position).toBe(6);
    expect(ctx.teams).toBe(22);
    expect(ctx.ppg).toBeCloseTo(2.0);
  });

  it("cup ties never count as league games", () => {
    expect(isLeague("FA Vase 1Q")).toBe(false);
    expect(isLeague("Herts Cup 1")).toBe(false);
    expect(isLeague("CCL Div One Challenge Cup 1")).toBe(false);
    expect(isLeague("Combined Counties Div 1")).toBe(true);
    // nine league results, one FA Vase win left out of the line
    expect(ctx.line).toHaveLength(9);
    expect(ctx.line.at(-1)?.points).toBe(18);
  });

  it("counts the league games left before christmas off the diary", () => {
    expect(christmasFor("2026-07-25")).toBe("2026-12-25");
    // 5 sep .. 19 dec, cups out, 28 dec is after the day
    expect(ctx.leagueGamesToChristmas).toBe(18);
    expect(ctx.atChristmasOnPace).toBe(54);
    // on pace now; two a game over 27 games is 54, which is twelve wins from the eighteen
    expect(ctx.behindPromotionPace).toBe(0);
    expect(ctx.atChristmasOnPromotionPace).toBe(54);
    expect(ctx.winsToChristmasForPromotionPace).toBe(12);
  });

  it("knows the gaps and the runs", () => {
    expect(ctx.gapToSecond).toBe(2);
    expect(ctx.gapToFifth).toBe(1);
    expect(ctx.form.map((f) => f.result).join("")).toBe("WWLLWW");
    expect(ctx.bestRun).toBe(2);
    expect(ctx.worstRun).toBe(2);
  });

  it("says it the way a gaffer would", () => {
    expect(ctx.sentences[0]).toBe("six wins from nine, two a game.");
    expect(ctx.sentences[1]).toBe("keep that to christmas and you're on 54, that is promotion pace.");
    expect(ctx.sentences).toContain("twelve wins from the eighteen league games before christmas keeps you on promotion pace on the day.");
    expect(ctx.sentences).toContain("2 points off second, 1 off the play-offs.");
  });
});

describe("season context, a club with nothing in yet", () => {
  const ctx = seasonContext({ results: [], standings: [], progress: [], fixtures: [], asOf: "2026-09-03" });
  it("is honest about it", () => {
    expect(ctx.hasSeason).toBe(false);
    expect(ctx.points).toBe(0);
    expect(ctx.line).toEqual([]);
    expect(ctx.sentences[0]).toMatch(/no league games in yet/);
  });
});

describe("words", () => {
  it("ordinals and number words", () => {
    expect(ordinal(1)).toBe("1st");
    expect(ordinal(2)).toBe("2nd");
    expect(ordinal(6)).toBe("6th");
    expect(ordinal(11)).toBe("11th");
    expect(ordinal(22)).toBe("22nd");
    expect(word(7)).toBe("seven");
    expect(word(42)).toBe("42");
  });
});
