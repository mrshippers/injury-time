import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import manifest from "../../scripts/crests/manifest.json";
import { crestFor, crestKey, monogram } from "../../src/lib/crests";
import live from "../../scripts/belstone-2026-27.json";

describe("crest lookup", () => {
  it("one club under any spelling the feeds use", () => {
    expect(crestKey("Staines & Lammas (Middlesex)")).toBe("staines-and-lammas");
    expect(crestFor("Staines & Lammas (Middlesex)")).toBe(crestFor("Staines and Lammas"));
    expect(crestFor("Staines & Lammas (Middlesex)")).toMatch(/^\/crests\/.+\.png$/);
    expect(crestFor("BROOK HOUSE")).toBe("/crests/brook-house.png");
  });
  it("a club with no crest on file is null, never a guess", () => {
    expect(crestFor("Nowhere Rovers")).toBeNull();
    expect(crestFor(null)).toBeNull();
  });
  it("every file the manifest names exists on disk", () => {
    for (const [name, v] of Object.entries(manifest as Record<string, { file: string | null }>)) {
      if (v.file) expect(existsSync(resolve(__dirname, "../../public/crests", v.file)), name).toBe(true);
    }
  });
  it("every club in the live table and every cup opponent has a crest", () => {
    const teams = new Set<string>(live.table.map((t) => t.team));
    for (const f of live.fixtures) if (/vase|cup/i.test(f.competition)) teams.add(f.opponent);
    const missing = [...teams].filter((t) => !crestFor(t));
    expect(missing).toEqual([]);
  });
  it("monograms are two letters", () => {
    expect(monogram("Brook House")).toBe("BH");
    expect(monogram("Belstone")).toBe("BE");
  });
});
