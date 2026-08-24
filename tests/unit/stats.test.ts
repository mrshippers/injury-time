import { describe, expect, it } from "vitest";
import { sumMatchRows } from "../../src/lib/stats";

describe("sumMatchRows", () => {
  it("counts an app for any minutes and a start for 60+", () => {
    const s = sumMatchRows([
      { minutes: 90, goals: 1, assists: 0, yellow: 1, red: 0 },
      { minutes: 20, goals: 1, assists: 1, yellow: 0, red: 0 },
      { minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 },
    ]);
    expect(s).toEqual({ apps: 2, starts: 1, minutes: 110, goals: 2, assists: 1, yellow: 1, red: 0 });
  });
  it("is empty for no rows, never NaN", () => {
    expect(sumMatchRows([])).toEqual({ apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 });
  });
});
