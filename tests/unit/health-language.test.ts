import { describe, expect, it } from "vitest";

import { HEALTH_LANGUAGES } from "../../src/lib/config";
import { WORDS, chartCaption, chartMeaning, loadDetail, loadLine, readinessGloss, usualPhrase } from "../../src/lib/health/language";
import { readinessFor } from "../../src/lib/readiness";

const facts = {
  sessions: 3,
  weekLoad: 1240,
  chronicAvg: 860,
  acwr: { kind: "ratio" as const, value: 1.44 },
  weekChange: { kind: "pct" as const, value: 0.32 },
};

describe("health words", () => {
  it("plain is sessions and a phrase; detailed is the numbers", () => {
    expect(loadLine("plain", facts)).toMatch(/^3 sessions this week · (well )?(over|under|about) his usual week$/);
    expect(loadLine("plain", { ...facts, sessions: 0 })).toBe("nothing logged this week");
    const d = loadLine("detailed", facts);
    expect(d).toContain("7-day 1,240 AU");
    expect(d).toContain("28-day avg 860 AU");
    expect(d).toContain("ratio 1.44");
    expect(d).toContain("+32% on last week");
    expect(loadDetail(facts)).toBe(d);
  });

  it("never fabricates a ratio", () => {
    const none = { ...facts, acwr: { kind: "insufficient_data" as const }, weekChange: { kind: "insufficient_data" as const } };
    expect(usualPhrase(none.acwr)).toBe("no comparison yet");
    expect(loadLine("detailed", none)).toContain("ratio needs four weeks");
    expect(loadLine("detailed", none)).not.toMatch(/ratio \d/);
  });

  it("every word table is complete for both modes and free of em dashes", () => {
    const dash = String.fromCharCode(0x2014);
    for (const mode of HEALTH_LANGUAGES) {
      for (const v of Object.values(WORDS[mode])) expect(v).not.toContain(dash);
      expect(chartCaption(mode)).not.toContain(dash);
      const r = readinessFor({ kind: "ratio", value: 1.6 }, "red");
      expect(readinessGloss(mode, r)).not.toContain(dash);
      const [a, b] = chartMeaning(mode, r, facts);
      expect(a.length).toBeGreaterThan(10);
      expect(b.length).toBeGreaterThan(10);
      expect(a + b).not.toContain(dash);
    }
    expect(Object.keys(WORDS.plain).sort()).toEqual(Object.keys(WORDS.detailed).sort());
  });
});
