import { describe, expect, it } from "vitest";

import { groundFor, matchGround } from "@/lib/weather/grounds";

describe("grounds", () => {
  it("Belstone is the Medburn Ground in Radlett, not the village in Devon", () => {
    const g = groundFor("Belstone")!;
    expect(g.ground).toMatch(/Medburn/);
    expect(g.lat).toBeGreaterThan(51.6);
    expect(g.lat).toBeLessThan(51.7);
  });
  it("matches the feed's spelling variants", () => expect(groundFor("Staines and Lammas")?.ground).toBe(groundFor("Staines & Lammas (Middlesex)")?.ground));
  it("home is our ground, away is theirs", () => {
    expect(matchGround("Belstone", { venue: "H", opponent: "Langley" })?.ground).toMatch(/Medburn/);
    expect(matchGround("Belstone", { venue: "A", opponent: "Langley" })?.ground).toMatch(/Arbour Park/);
  });
  it("an unconfirmed ground and an unknown club are nothing, never a guess", () => {
    expect(groundFor("Eagles Land Benfica")).toBeNull();
    expect(groundFor("Dunstable Town")).toBeNull();
  });
});
