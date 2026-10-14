import { describe, expect, it } from "vitest";

import { reconcileFixtures, type DiaryRow, type FeedFixture } from "@/lib/league/reconcile";

const row = (id: string, match_date: string, opponent: string, competition = "Combined Counties Div 1", venue: "H" | "A" = "H", kickoff: string | null = "15:00"): DiaryRow => ({ id, match_date, opponent, competition, venue, kickoff });
const feed = (match_date: string, opponent: string, competition = "Combined Counties Div 1", venue: "H" | "A" = "H", kickoff: string | null = "15:00"): FeedFixture => ({ match_date, opponent, competition, venue, kickoff });
const TODAY = "2026-10-14";

describe("reconcileFixtures", () => {
  it("leaves a diary that already matches the feed alone", () => {
    const r = reconcileFixtures([row("a", "2026-10-17", "Staines")], [feed("2026-10-17", "Staines")], TODAY);
    expect(r).toEqual({ insert: [], move: [], remove: [], keptWithWork: [] });
  });

  it("inserts a game the diary has never heard of", () => {
    const r = reconcileFixtures([], [feed("2026-10-31", "Wisbech Town", "FA Vase 2")], TODAY);
    expect(r.insert.map((f) => f.opponent)).toEqual(["Wisbech Town"]);
  });

  it("moves a rescheduled game in place so its calls follow it", () => {
    const r = reconcileFixtures([row("lang", "2026-10-24", "Berks County")], [feed("2026-11-03", "Berks County", "Combined Counties Div 1", "A", "19:45")], TODAY);
    expect(r.move).toEqual([{ id: "lang", patch: { match_date: "2026-11-03", kickoff: "19:45", venue: "A" } }]);
    expect(r.insert).toEqual([]);
    expect(r.remove).toEqual([]);
  });

  it("removes a future game the feed dropped", () => {
    const r = reconcileFixtures([row("ghost", "2026-10-24", "Berks County")], [], TODAY);
    expect(r.remove).toEqual(["ghost"]);
  });

  it("never removes a dropped game that has calls or a side on it", () => {
    const r = reconcileFixtures([row("ghost", "2026-10-24", "Berks County")], [], TODAY, new Set(["ghost"]));
    expect(r.remove).toEqual([]);
    expect(r.keptWithWork).toEqual([{ id: "ghost", match_date: "2026-10-24", opponent: "Berks County" }]);
  });

  it("never touches a game already played, whatever the feed says", () => {
    const r = reconcileFixtures([row("old", "2026-10-10", "Langley"), row("old2", "2026-10-03", "Woodley United")], [], TODAY);
    expect(r).toEqual({ insert: [], move: [], remove: [], keptWithWork: [] });
  });

  it("a postponed game with no new date is not a fixture", () => {
    // the feed shows it as "P - P"; the caller drops it before it gets here, so the diary row is an orphan
    const r = reconcileFixtures([row("p", "2026-10-31", "PFC Victoria London")], [feed("2026-10-31", "Wisbech Town", "FA Vase 2")], TODAY);
    expect(r.remove).toEqual(["p"]);
  });

  it("two orphans against one reschedule: one moves, the other goes", () => {
    const r = reconcileFixtures([row("a", "2026-10-24", "Langley"), row("b", "2026-10-28", "Langley")], [feed("2026-10-20", "Langley")], TODAY);
    expect(r.move.map((m) => m.id)).toEqual(["a"]);
    expect(r.remove).toEqual(["b"]);
  });

  it("a kickoff that firmed up is refreshed in place", () => {
    const r = reconcileFixtures([row("a", "2026-10-17", "Staines", "Combined Counties Div 1", "H", null)], [feed("2026-10-17", "Staines", "Combined Counties Div 1", "H", "15:00")], TODAY);
    expect(r.move).toEqual([{ id: "a", patch: { match_date: "2026-10-17", kickoff: "15:00", venue: "H" } }]);
  });
});
