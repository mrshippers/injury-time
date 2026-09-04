import { describe, expect, it } from "vitest";
import { fromExternalStats, sumMatchRows } from "../../src/lib/stats";

describe("sumMatchRows", () => {
  it("counts an app for any minutes and a start for 60+", () => {
    const s = sumMatchRows([
      { minutes: 90, goals: 1, assists: 0, yellow: 1, red: 0 },
      { minutes: 20, goals: 1, assists: 1, yellow: 0, red: 0 },
      { minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 },
    ]);
    expect(s).toEqual({ apps: 2, starts: 1, minutes: 110, goals: 2, assists: 1, yellow: 1, red: 0, source: "log" });
  });
  it("is empty for no rows, never NaN", () => {
    expect(sumMatchRows([])).toEqual({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, source: "none" });
  });
});

describe("fromExternalStats", () => {
  it("carries apps and goals from the feed and says so", () => {
    expect(fromExternalStats({ apps: 9, goals: 4 })).toEqual({ apps: 9, starts: 0, minutes: 0, goals: 4, assists: 0, yellow: 0, red: 0, source: "feed" });
  });
  it("is empty, from nowhere, when the feed has nothing", () => {
    expect(fromExternalStats(null).source).toBe("none");
    expect(fromExternalStats({}).apps).toBe(0);
  });
});
