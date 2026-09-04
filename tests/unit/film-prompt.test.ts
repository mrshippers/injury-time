import { describe, expect, it } from "vitest";
import { ANALYST_SYSTEM, buildAnalysisMessage } from "../../src/lib/film/prompt";
import { cleanEvents } from "../../src/lib/film/analyse";

const players = [
  { id: "p9", name: "Bobby Ashworth", position: "FW" as const, squad_number: 9 },
  { id: "p1", name: "Marcus Oyelaran", position: "GK" as const, squad_number: 1 },
];

describe("the analyst's brief", () => {
  it("names the game, lists events in time order with the player, and hands over the squad ids", () => {
    const msg = buildAnalysisMessage({
      club: { name: "Kilburn Athletic", league: "Spartan South Midlands League", division: "Premier Division" },
      clip: { title: "first half", source: "youtube", matchDate: "2026-08-29", opponent: "Tring Athletic" },
      result: { venue: "H", goalsFor: 2, goalsAgainst: 1, competition: "League" },
      fixture: null,
      events: [
        { t: 1500, kind: "save", player_id: "p1" },
        { t: 312, kind: "goal", player_id: "p9", note: "far post from a corner" },
      ],
      players,
      readiness: { p9: "red zone" },
    });
    expect(msg).toContain("Kilburn Athletic 2 1 Tring Athletic, at home");
    expect(msg.indexOf("5:12 goal Bobby Ashworth (FW 9): far post from a corner")).toBeLessThan(msg.indexOf("25:00 save Marcus Oyelaran (GK 1)"));
    expect(msg).toContain("p9 Bobby Ashworth FW 9 red zone");
    expect(msg).toContain("Only use player ids from the squad list");
    expect(ANALYST_SYSTEM).toContain("Never invent an event");
  });

  it("says when nothing is tagged rather than inventing a game", () => {
    const msg = buildAnalysisMessage({
      club: { name: "Belstone", league: "Combined Counties League", division: "Division One" },
      clip: { title: "raw", source: "veo", matchDate: null, opponent: null },
      result: null,
      fixture: null,
      events: [],
      players,
      readiness: {},
    });
    expect(msg).toContain("(none tagged)");
    expect(msg).not.toContain("The game:");
  });

  it("drops events with unknown kinds or broken times before they reach the prompt", () => {
    const events = cleanEvents([
      { t: 10, kind: "goal" },
      { t: Number.NaN, kind: "goal" },
      { t: 20, kind: "dance" as never },
    ]);
    expect(events).toEqual([{ t: 10, kind: "goal" }]);
  });
});
