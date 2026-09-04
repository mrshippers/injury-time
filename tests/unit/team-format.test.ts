import { describe, expect, it } from "vitest";
import { countCalls, countLine, daysAwayWord, timeAgo, weekdayWord } from "../../src/lib/team/format";

describe("team vocabulary", () => {
  it("counts calls and treats a missing row as not answered", () => {
    const c = countCalls(
      ["a", "b", "c", "d", "e"],
      [
        { player_id: "a", status: "in" },
        { player_id: "b", status: "in" },
        { player_id: "c", status: "out" },
        { player_id: "d", status: "unsure" },
      ],
    );
    expect(c).toEqual({ in: 2, out: 1, unsure: 1, unanswered: 1 });
    expect(countLine(c)).toBe("2 in · 1 out · 1 unsure · 1 not answered");
  });

  it("drops empty buckets from the line but always says how many are in", () => {
    expect(countLine({ in: 0, out: 0, unsure: 0, unanswered: 22 })).toBe("0 in · 22 not answered");
    expect(countLine({ in: 14, out: 0, unsure: 0, unanswered: 0 })).toBe("14 in");
  });

  it("says how long ago in words a phone would use", () => {
    const now = Date.parse("2026-09-04T12:00:00Z");
    expect(timeAgo("2026-09-04T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-09-04T11:58:00Z", now)).toBe("2 min ago");
    expect(timeAgo("2026-09-04T09:00:00Z", now)).toBe("3 hours ago");
    expect(timeAgo("2026-09-03T11:00:00Z", now)).toBe("yesterday");
    expect(timeAgo("2026-08-31T11:00:00Z", now)).toBe("4 days ago");
    expect(timeAgo("not a date", now)).toBe("");
  });

  it("names the day and the distance", () => {
    expect(weekdayWord("2026-09-05")).toBe("saturday");
    expect(daysAwayWord(0)).toBe("today");
    expect(daysAwayWord(1)).toBe("tomorrow");
    expect(daysAwayWord(4)).toBe("in 4 days");
    expect(daysAwayWord(-2)).toBe("2 days ago");
  });
});
