import { describe, expect, it } from "vitest";
import { readinessFor } from "../../src/lib/readiness";

describe("readinessFor", () => {
  it("never invents a word when there is no ratio", () => {
    const r = readinessFor({ kind: "insufficient_data" }, "cold");
    expect(r.key).toBe("unknown");
    expect(r.ratio).toBeNull();
    expect(r.word).toBe("no reading");
  });

  it("splits watch into undercooked (low) and pushing it (high)", () => {
    expect(readinessFor({ kind: "ratio", value: 0.6 }, "watch").key).toBe("undercooked");
    expect(readinessFor({ kind: "ratio", value: 1.35 }, "watch").key).toBe("pushing");
  });

  it("maps ok and red straight through and keeps the ratio", () => {
    expect(readinessFor({ kind: "ratio", value: 1.0 }, "ok")).toMatchObject({ key: "steady", ratio: 1.0 });
    expect(readinessFor({ kind: "ratio", value: 1.7 }, "red")).toMatchObject({ key: "red", ratio: 1.7 });
  });

  it("every gloss is a single plain sentence with no jargon", () => {
    for (const [flag, value] of [["cold", null], ["ok", 1], ["watch", 0.5], ["watch", 1.35], ["red", 1.6]] as const) {
      const r = readinessFor(value === null ? { kind: "insufficient_data" } : { kind: "ratio", value }, flag);
      expect(r.gloss).not.toMatch(/acwr|ratio|chronic|acute/i);
      expect(r.gloss.split(". ").length).toBe(1);
    }
  });
});
