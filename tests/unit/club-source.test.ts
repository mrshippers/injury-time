import { describe, expect, it } from "vitest";

import { sourceLine } from "../../src/lib/club/source";

describe("where the season came from", () => {
  it("never calls a snapshot live", () => {
    const s = sourceLine({ season_source: "snapshot", season_synced_at: "2026-09-02T00:00:00Z", is_demo: true });
    expect(s.short).toBe("league data: a copy of the public league pages from 2 Sept, not live");
    expect(s.short).not.toMatch(/live feed/);
  });
  it("names the club's own key and when it last synced", () => {
    expect(sourceLine({ season_source: "feed", season_synced_at: "2026-09-29T05:15:00Z", is_demo: false }).short).toBe(
      "league feed: the club's Football Web Pages key, synced 29 Sept",
    );
  });
  it("says a fictional side's results are entered, and says it is fictional", () => {
    expect(sourceLine({ season_source: "manual", season_synced_at: null, is_demo: true }).short).toMatch(/fictional/);
  });
});
