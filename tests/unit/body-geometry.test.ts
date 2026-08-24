import { describe, expect, it } from "vitest";
import { BODY_REGIONS } from "../../src/lib/types";
import { PARTS } from "../../src/components/player/body-geometry";

describe("body geometry", () => {
  it("every body region the database accepts has at least one part", () => {
    const present = new Set(PARTS.map((p) => p.region).filter(Boolean));
    for (const r of BODY_REGIONS) expect(present.has(r), `missing ${r}`).toBe(true);
  });
  it("two-sided regions have a left and a right, mirrored across x", () => {
    for (const region of ["quad", "hamstring", "knee", "calf", "shin", "ankle", "foot", "hip", "shoulder", "achilles", "wrist_hand"]) {
      const l = PARTS.find((p) => p.region === region && p.side === "left")!;
      const r = PARTS.find((p) => p.region === region && p.side === "right")!;
      expect(l.pos[0]).toBeGreaterThan(0);
      expect(r.pos[0]).toBeCloseTo(-l.pos[0]);
    }
  });
  it("front and back halves of a limb share a position so the seam is exact", () => {
    const q = PARTS.find((p) => p.region === "quad" && p.side === "left")!;
    const h = PARTS.find((p) => p.region === "hamstring" && p.side === "left")!;
    expect(q.pos).toEqual(h.pos);
  });
});
