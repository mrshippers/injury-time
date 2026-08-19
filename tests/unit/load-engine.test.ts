import { describe, expect, it } from "vitest";
import {
  acuteLoad,
  chronicWeeklyAvg,
  acwr,
  weekOnWeekChange,
  flagFor,
  type LoadEntry,
} from "../../src/lib/load-engine";

/**
 * All fixtures are anchored to asOf = 2026-03-28.
 *
 * The 28-day chronic window is 2026-03-01 .. 2026-03-28 inclusive, which splits
 * into four trailing 7-day blocks:
 *
 *   block A (oldest) 2026-03-01 .. 2026-03-07
 *   block B          2026-03-08 .. 2026-03-14
 *   block C          2026-03-15 .. 2026-03-21
 *   block D (acute)  2026-03-22 .. 2026-03-28   <- the acute window
 *
 * A baseline part-time week is two training sessions and one match:
 *   training  RPE 6 x 70 min = 420 AU   (x2 = 840)
 *   match     RPE 8 x 90 min = 720 AU
 *   weekly total = 420 + 420 + 720 = 1560 AU
 */
const ASOF = "2026-03-28";

/** Baseline 1560 AU week laid out on days 1, 3 and 7 of the given block. */
const WEEK_A: LoadEntry[] = [
  { date: "2026-03-01", load: 420 },
  { date: "2026-03-03", load: 420 },
  { date: "2026-03-07", load: 720 },
];
const WEEK_B: LoadEntry[] = [
  { date: "2026-03-08", load: 420 },
  { date: "2026-03-10", load: 420 },
  { date: "2026-03-14", load: 720 },
];
const WEEK_C: LoadEntry[] = [
  { date: "2026-03-15", load: 420 },
  { date: "2026-03-17", load: 420 },
  { date: "2026-03-21", load: 720 },
];
const WEEK_D: LoadEntry[] = [
  { date: "2026-03-22", load: 420 },
  { date: "2026-03-24", load: 420 },
  { date: "2026-03-28", load: 720 },
];

describe("acuteLoad", () => {
  it("sums the 7 days ending at asOf inclusive", () => {
    // block D only: 420 + 420 + 720 = 1560
    expect(acuteLoad([...WEEK_A, ...WEEK_B, ...WEEK_C, ...WEEK_D], ASOF)).toBe(1560);
  });

  it("returns 0 for an empty history", () => {
    expect(acuteLoad([], ASOF)).toBe(0);
  });

  it("sums multiple sessions recorded on the same date", () => {
    // 420 + 300 on 2026-03-24 = 720
    const loads: LoadEntry[] = [
      { date: "2026-03-24", load: 420 },
      { date: "2026-03-24", load: 300 },
    ];
    expect(acuteLoad(loads, ASOF)).toBe(720);
  });

  // Fixture (9): date boundary.
  it("excludes a load exactly 7 days before asOf and includes one exactly 6 days before", () => {
    // asOf     = 2026-03-28
    // asOf - 6 = 2026-03-22  -> INSIDE  the window
    // asOf - 7 = 2026-03-21  -> OUTSIDE the window
    const loads: LoadEntry[] = [
      { date: "2026-03-21", load: 100 }, // excluded
      { date: "2026-03-22", load: 200 }, // included
      { date: "2026-03-28", load: 50 }, // included (asOf itself)
      { date: "2026-03-29", load: 999 }, // excluded (after asOf)
    ];
    // 200 + 50 = 250
    expect(acuteLoad(loads, ASOF)).toBe(250);
  });

  it("handles a window that crosses a month boundary", () => {
    // asOf = 2026-03-01, asOf - 6 = 2026-02-23 (2026 is not a leap year)
    const loads: LoadEntry[] = [
      { date: "2026-02-22", load: 100 }, // excluded
      { date: "2026-02-23", load: 200 }, // included
      { date: "2026-03-01", load: 300 }, // included
    ];
    // 200 + 300 = 500
    expect(acuteLoad(loads, "2026-03-01")).toBe(500);
  });

  it("handles a leap-year February", () => {
    // asOf = 2024-03-01, asOf - 6 = 2024-02-24 (2024 IS a leap year, 29 Feb exists)
    const loads: LoadEntry[] = [
      { date: "2024-02-23", load: 100 }, // excluded
      { date: "2024-02-24", load: 200 }, // included
      { date: "2024-02-29", load: 300 }, // included
    ];
    // 200 + 300 = 500
    expect(acuteLoad(loads, "2024-03-01")).toBe(500);
  });
});

describe("chronicWeeklyAvg", () => {
  it("averages the four trailing 7-day block sums", () => {
    // blocks: 1560 + 1560 + 1560 + 1560 = 6240; 6240 / 4 = 1560
    expect(chronicWeeklyAvg([...WEEK_A, ...WEEK_B, ...WEEK_C, ...WEEK_D], ASOF)).toBe(1560);
  });

  it("ignores loads older than 28 days and later than asOf", () => {
    const loads: LoadEntry[] = [
      { date: "2026-02-28", load: 9999 }, // asOf - 28, outside the window
      { date: "2026-03-01", load: 400 }, // asOf - 27, oldest day inside
      { date: "2026-03-28", load: 400 }, // asOf itself
      { date: "2026-03-30", load: 9999 }, // after asOf
    ];
    // (400 + 400) / 4 = 200
    expect(chronicWeeklyAvg(loads, ASOF)).toBe(200);
  });

  // Fixture (6): missing days are 0 load, not skipped.
  it("counts empty blocks as zero rather than skipping them", () => {
    // Two trained weeks (A and B) then two blank weeks (C and D).
    // total = 1560 + 1560 + 0 + 0 = 3120; 3120 / 4 = 780
    // (If blank blocks were skipped the mean would wrongly be 3120 / 2 = 1560.)
    expect(chronicWeeklyAvg([...WEEK_A, ...WEEK_B], ASOF)).toBe(780);
  });
});

describe("acwr", () => {
  // Fixture (1): steady state.
  it("returns exactly 1.00 for four identical weeks", () => {
    // acute   = 1560
    // chronic = (1560 + 1560 + 1560 + 1560) / 4 = 1560
    // ratio   = 1560 / 1560 = 1.00
    const result = acwr([...WEEK_A, ...WEEK_B, ...WEEK_C, ...WEEK_D], ASOF);
    expect(result).toEqual({ kind: "ratio", value: 1 });
  });

  // Fixture (2): spike week.
  it("returns 1.60 when the final week doubles", () => {
    const doubledWeekD: LoadEntry[] = [
      { date: "2026-03-22", load: 840 },
      { date: "2026-03-24", load: 840 },
      { date: "2026-03-28", load: 1440 },
    ];
    // acute   = 840 + 840 + 1440 = 3120
    // chronic = (1560 + 1560 + 1560 + 3120) / 4 = 7800 / 4 = 1950
    // ratio   = 3120 / 1950 = 1.6
    const result = acwr([...WEEK_A, ...WEEK_B, ...WEEK_C, ...doubledWeekD], ASOF);
    expect(result).toEqual({ kind: "ratio", value: 1.6 });
  });

  it("rounds the ratio to 2dp", () => {
    // An extra match (720 AU) in the final week.
    const twoMatchWeekD: LoadEntry[] = [...WEEK_D, { date: "2026-03-26", load: 720 }];
    // acute   = 1560 + 720 = 2280
    // chronic = (1560 + 1560 + 1560 + 2280) / 4 = 6960 / 4 = 1740
    // ratio   = 2280 / 1740 = 1.3103448... -> 1.31
    const result = acwr([...WEEK_A, ...WEEK_B, ...WEEK_C, ...twoMatchWeekD], ASOF);
    expect(result).toEqual({ kind: "ratio", value: 1.31 });
  });

  // Fixture (3): taper.
  it("returns 0.57 when the final week halves", () => {
    const halvedWeekD: LoadEntry[] = [
      { date: "2026-03-22", load: 210 },
      { date: "2026-03-24", load: 210 },
      { date: "2026-03-28", load: 360 },
    ];
    // acute   = 210 + 210 + 360 = 780
    // chronic = (1560 + 1560 + 1560 + 780) / 4 = 5460 / 4 = 1365
    // ratio   = 780 / 1365 = 0.5714285... -> 0.57
    const result = acwr([...WEEK_A, ...WEEK_B, ...WEEK_C, ...halvedWeekD], ASOF);
    expect(result).toEqual({ kind: "ratio", value: 0.57 });
  });

  // Fixture (6): gap weeks.
  it("returns 0.00 when the last two weeks are blank (missing days count as 0)", () => {
    // acute   = 0 (no sessions in block D)
    // chronic = (1560 + 1560 + 0 + 0) / 4 = 780
    // ratio   = 0 / 780 = 0.00
    const result = acwr([...WEEK_A, ...WEEK_B], ASOF);
    expect(result).toEqual({ kind: "ratio", value: 0 });
  });

  // Fixture (4): cold start.
  it("returns insufficient_data with only 10 days of history", () => {
    // Earliest record 2026-03-19 is later than asOf - 27 = 2026-03-01,
    // so there is no full 28-day window to average over.
    const loads: LoadEntry[] = [
      { date: "2026-03-19", load: 420 },
      { date: "2026-03-21", load: 720 },
      { date: "2026-03-24", load: 420 },
      { date: "2026-03-28", load: 720 },
    ];
    expect(acwr(loads, ASOF)).toEqual({ kind: "insufficient_data" });
  });

  it("returns insufficient_data on the day before a full window exists, and a ratio on the day it does", () => {
    // Earliest record is 2026-03-02.
    const loads: LoadEntry[] = [
      { date: "2026-03-02", load: 400 },
      { date: "2026-03-28", load: 400 },
    ];
    // At asOf = 2026-03-28: asOf - 27 = 2026-03-01, earliest (03-02) is LATER -> insufficient.
    expect(acwr(loads, "2026-03-28")).toEqual({ kind: "insufficient_data" });
    // At asOf = 2026-03-29: asOf - 27 = 2026-03-02, earliest is not later -> ratio.
    // acute (03-23..03-29)  = 400
    // chronic (03-02..03-29) = (400 + 400) / 4 = 200
    // ratio = 400 / 200 = 2.00
    expect(acwr(loads, "2026-03-29")).toEqual({ kind: "ratio", value: 2 });
  });

  it("returns insufficient_data for an empty history", () => {
    expect(acwr([], ASOF)).toEqual({ kind: "insufficient_data" });
  });

  // Fixture (5): chronic zero.
  it("returns insufficient_data rather than NaN or Infinity when chronic load is zero", () => {
    // A long-term absentee: 28+ days of history, every session recorded as 0 AU,
    // plus a session dated AFTER asOf (so it is outside every window).
    // acute = 0, chronic = 0 -> 0 / 0 would be NaN, and any acute > 0 over a zero
    // chronic would be Infinity. Neither may ever reach the UI.
    const loads: LoadEntry[] = [
      { date: "2026-02-20", load: 0 },
      { date: "2026-03-01", load: 0 },
      { date: "2026-03-15", load: 0 },
      { date: "2026-03-28", load: 0 },
      { date: "2026-03-29", load: 1560 },
    ];
    const result = acwr(loads, ASOF);
    expect(result).toEqual({ kind: "insufficient_data" });
    expect(result).not.toHaveProperty("value");
  });

  it("never leaks a sentinel number on the insufficient_data branch", () => {
    // Hard product constraint: the discriminated union must have no numeric member
    // on the insufficient_data case, so no 0 / -1 / null can be rendered as a ratio.
    const result = acwr([{ date: "2026-03-27", load: 500 }], ASOF);
    expect(result.kind).toBe("insufficient_data");
    expect(Object.keys(result)).toEqual(["kind"]);
  });
});

describe("weekOnWeekChange", () => {
  // Fixture (7): exact week-on-week fixture.
  it("computes the increase from last week to this week to 3dp", () => {
    // this week (03-22..03-28) = 420 + 420 + 720 + 720 = 2280
    // last week (03-15..03-21) = 420 + 420 + 720 = 1560
    // change = (2280 - 1560) / 1560 = 720 / 1560 = 0.4615384... -> 0.462
    const loads: LoadEntry[] = [...WEEK_C, ...WEEK_D, { date: "2026-03-26", load: 720 }];
    expect(weekOnWeekChange(loads, ASOF)).toEqual({ kind: "pct", value: 0.462 });
  });

  it("computes a decrease as a negative fraction", () => {
    // this week = 210 + 210 + 360 = 780
    // last week = 1560
    // change = (780 - 1560) / 1560 = -780 / 1560 = -0.5
    const loads: LoadEntry[] = [
      ...WEEK_C,
      { date: "2026-03-22", load: 210 },
      { date: "2026-03-24", load: 210 },
      { date: "2026-03-28", load: 360 },
    ];
    expect(weekOnWeekChange(loads, ASOF)).toEqual({ kind: "pct", value: -0.5 });
  });

  it("returns 0 for an unchanged week", () => {
    // (1560 - 1560) / 1560 = 0
    expect(weekOnWeekChange([...WEEK_C, ...WEEK_D], ASOF)).toEqual({ kind: "pct", value: 0 });
  });

  it("returns -1 when this week is blank but last week was not", () => {
    // this week = 0, last week = 1560 -> (0 - 1560) / 1560 = -1
    expect(weekOnWeekChange([...WEEK_C], ASOF)).toEqual({ kind: "pct", value: -1 });
  });

  it("returns insufficient_data when last week's block sum is zero", () => {
    // Last week (03-15..03-21) has records but they total 0 AU: dividing by 0
    // would give Infinity, so there is no honest percentage to show.
    const loads: LoadEntry[] = [
      { date: "2026-03-17", load: 0 },
      { date: "2026-03-21", load: 0 },
      ...WEEK_D,
    ];
    expect(weekOnWeekChange(loads, ASOF)).toEqual({ kind: "insufficient_data" });
  });

  it("returns insufficient_data when there is no data at all before this week", () => {
    // Every record sits inside 03-22..03-28: a first-week player has nothing to compare to.
    expect(weekOnWeekChange([...WEEK_D], ASOF)).toEqual({ kind: "insufficient_data" });
  });

  it("respects the block boundaries exactly", () => {
    // last week spans asOf-13 (03-15) .. asOf-7 (03-21)
    const loads: LoadEntry[] = [
      { date: "2026-03-14", load: 999 }, // asOf - 14, outside last week
      { date: "2026-03-15", load: 500 }, // asOf - 13, first day of last week
      { date: "2026-03-21", load: 500 }, // asOf - 7,  last day of last week
      { date: "2026-03-22", load: 1500 }, // asOf - 6,  first day of this week
    ];
    // this week = 1500, last week = 1000 -> (1500 - 1000) / 1000 = 0.5
    expect(weekOnWeekChange(loads, ASOF)).toEqual({ kind: "pct", value: 0.5 });
  });
});

/**
 * Builds a history whose acute week sums to `acuteTotal` and whose three older
 * weeks sum to `olderTotal`, with the oldest record on asOf - 27 so the 28-day
 * window is always complete.
 *
 * ACWR = acute / ((acute + older) / 4) = 4 * acute / (acute + older).
 */
function historyWith(acuteTotal: number, olderTotal: number): LoadEntry[] {
  return [
    { date: "2026-03-01", load: olderTotal }, // block A (also fixes the window start)
    { date: "2026-03-10", load: 0 }, // block B
    { date: "2026-03-17", load: 0 }, // block C
    { date: "2026-03-25", load: acuteTotal }, // block D (acute)
  ];
}

describe("flagFor", () => {
  it("returns cold when there is not enough history for an ACWR", () => {
    // Fixture (4) again, through the flag: 10 days of history.
    const loads: LoadEntry[] = [
      { date: "2026-03-19", load: 420 },
      { date: "2026-03-28", load: 720 },
    ];
    expect(flagFor(loads, ASOF)).toBe("cold");
  });

  it("returns cold when chronic load is zero", () => {
    const loads: LoadEntry[] = [
      { date: "2026-03-01", load: 0 },
      { date: "2026-03-28", load: 0 },
    ];
    expect(flagFor(loads, ASOF)).toBe("cold");
  });

  it("returns ok for a steady 1.00", () => {
    expect(flagFor([...WEEK_A, ...WEEK_B, ...WEEK_C, ...WEEK_D], ASOF)).toBe("ok");
  });

  // Fixture (8): boundaries.
  it("treats an ACWR of exactly 1.3 (watchHigh) as ok", () => {
    // acute = 1300, older = 2700 -> chronic = (1300 + 2700) / 4 = 1000
    // ratio = 1300 / 1000 = 1.30, and watch starts strictly ABOVE watchHigh.
    const loads = historyWith(1300, 2700);
    expect(acwr(loads, ASOF)).toEqual({ kind: "ratio", value: 1.3 });
    expect(flagFor(loads, ASOF)).toBe("ok");
  });

  it("treats an ACWR of exactly 1.5 (redHigh) as watch", () => {
    // acute = 1500, older = 2500 -> chronic = (1500 + 2500) / 4 = 1000
    // ratio = 1500 / 1000 = 1.50, and red starts strictly ABOVE redHigh.
    const loads = historyWith(1500, 2500);
    expect(acwr(loads, ASOF)).toEqual({ kind: "ratio", value: 1.5 });
    expect(flagFor(loads, ASOF)).toBe("watch");
  });

  it("treats an ACWR of exactly 0.8 (watchLow) as ok", () => {
    // acute = 800, older = 3200 -> chronic = 4000 / 4 = 1000
    // ratio = 800 / 1000 = 0.80, and the low watch band is strictly BELOW watchLow.
    const loads = historyWith(800, 3200);
    expect(acwr(loads, ASOF)).toEqual({ kind: "ratio", value: 0.8 });
    expect(flagFor(loads, ASOF)).toBe("ok");
  });

  it("returns watch just below watchLow", () => {
    // acute = 790, older = 3210 -> chronic = 4000 / 4 = 1000; ratio = 0.79
    const loads = historyWith(790, 3210);
    expect(acwr(loads, ASOF)).toEqual({ kind: "ratio", value: 0.79 });
    expect(flagFor(loads, ASOF)).toBe("watch");
  });

  it("returns watch just above watchHigh", () => {
    // acute = 1310, older = 2690 -> chronic = 4000 / 4 = 1000; ratio = 1.31
    const loads = historyWith(1310, 2690);
    expect(flagFor(loads, ASOF)).toBe("watch");
  });

  it("returns red just above redHigh", () => {
    // acute = 1510, older = 2490 -> chronic = 4000 / 4 = 1000; ratio = 1.51
    const loads = historyWith(1510, 2490);
    expect(acwr(loads, ASOF)).toEqual({ kind: "ratio", value: 1.51 });
    expect(flagFor(loads, ASOF)).toBe("red");
  });

  it("honours injected thresholds", () => {
    // acute = 1600, older = 2400 -> chronic = 4000 / 4 = 1000; ratio = 1.60
    const loads = historyWith(1600, 2400);
    expect(acwr(loads, ASOF)).toEqual({ kind: "ratio", value: 1.6 });
    // Default redHigh 1.5: 1.60 > 1.50 -> red
    expect(flagFor(loads, ASOF)).toBe("red");
    // Raised redHigh 1.7: 1.30 < 1.60 <= 1.70 -> watch
    expect(flagFor(loads, ASOF, { watchLow: 0.8, watchHigh: 1.3, redHigh: 1.7 })).toBe("watch");
    // Lowered redHigh 1.2 (below watchHigh): 1.60 > 1.20 -> red
    expect(flagFor(loads, ASOF, { watchLow: 0.8, watchHigh: 1.3, redHigh: 1.2 })).toBe("red");
    // Widened watch band: 1.60 <= watchHigh 1.8 and >= watchLow 0.5 -> ok
    expect(flagFor(loads, ASOF, { watchLow: 0.5, watchHigh: 1.8, redHigh: 2 })).toBe("ok");
  });
});

describe("input validation", () => {
  it("rejects a date that is not ISO yyyy-mm-dd", () => {
    expect(() => acuteLoad([{ date: "28/03/2026", load: 100 }], ASOF)).toThrow(RangeError);
    expect(() => acuteLoad([], "2026-3-28")).toThrow(RangeError);
  });

  it("rejects a date that is not a real calendar day", () => {
    // 2026 is not a leap year, so 29 February does not exist.
    expect(() => acuteLoad([{ date: "2026-02-29", load: 100 }], ASOF)).toThrow(RangeError);
  });

  it("rejects a non-finite load rather than propagating NaN into a ratio", () => {
    expect(() => acuteLoad([{ date: "2026-03-24", load: Number.NaN }], ASOF)).toThrow(RangeError);
    expect(() => acuteLoad([{ date: "2026-03-24", load: Infinity }], ASOF)).toThrow(RangeError);
  });
});
