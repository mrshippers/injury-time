import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { DEFAULT_ATHLETE, MANIFEST, figureScale } from "../../src/lib/body/params";
import { classifyRegions } from "../../src/lib/body/regions";
import { BODY_REGIONS } from "../../src/lib/types";

/** Reads the shipped asset the way the browser will, minus three. */
function loadPositions(): { positions: Float32Array; indices: Uint16Array } {
  const buf = readFileSync("public/body/athlete.bin");
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  const n = MANIFEST.vertexCount;
  return {
    positions: new Float32Array(ab, MANIFEST.offsets.positions, n * 3),
    indices: new Uint16Array(ab, MANIFEST.offsets.indices, MANIFEST.triangleCount * 3),
  };
}

describe("the converted body asset", () => {
  const { positions, indices } = loadPositions();
  const n = MANIFEST.vertexCount;

  it("is in the shared frame: metres, feet on the floor, facing +z, centred", () => {
    let minY = Infinity, maxY = -Infinity, minX = Infinity, maxX = -Infinity, sumZToes = 0, toes = 0, sumZHead = 0, head = 0;
    for (let v = 0; v < n; v += 1) {
      const x = positions[v * 3], y = positions[v * 3 + 1], z = positions[v * 3 + 2];
      minY = Math.min(minY, y); maxY = Math.max(maxY, y); minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      if (y < 0.03) { sumZToes += z; toes += 1; }
      if (y > 1.5 && Math.abs(x) < 0.05) { sumZHead += z; head += 1; }
    }
    expect(minY).toBeGreaterThan(-0.005);
    expect(minY).toBeLessThan(0.005);
    expect(maxY).toBeCloseTo(MANIFEST.baseHeight, 3);
    expect(Math.abs(minX + maxX)).toBeLessThan(0.01);
    // toes point forward, so the feet sit ahead of the head's average z
    expect(sumZToes / toes).toBeGreaterThan(sumZHead / head - 0.02);
    expect(indices.length).toBe(MANIFEST.triangleCount * 3);
    for (let i = 0; i < indices.length; i += 1) expect(indices[i]).toBeLessThan(n);
  });

  it("gives every region some skin at the default athlete's scale, sides included", () => {
    const map = classifyRegions(positions, n, undefined, figureScale(DEFAULT_ATHLETE));
    const owned = new Set(map.parts.filter((_, i) => map.partVerts[i].length > 0).map((p) => p.key));
    for (const r of BODY_REGIONS) expect([...owned].some((k) => k.startsWith(`${r}-`)), `no skin for ${r}`).toBe(true);
    for (const r of ["quad", "hamstring", "calf", "shin", "knee", "ankle", "foot", "arm", "shoulder", "hip"]) {
      expect(owned.has(`${r}-left`), `${r}-left`).toBe(true);
      expect(owned.has(`${r}-right`), `${r}-right`).toBe(true);
    }
  });

  it("the front of the left thigh is quad and the back is hamstring", () => {
    const s = figureScale(DEFAULT_ATHLETE);
    const map = classifyRegions(positions, n, undefined, s);
    const key = (v: number) => map.parts[map.vertexPart[v]].key;
    let front: string | null = null;
    let back: string | null = null;
    let frontZ = -Infinity;
    let backZ = Infinity;
    for (let v = 0; v < n; v += 1) {
      const x = positions[v * 3] * s, y = positions[v * 3 + 1] * s, z = positions[v * 3 + 2] * s;
      if (x > 0.06 && x < 0.2 && Math.abs(y - 0.7) < 0.04) {
        if (z > frontZ) { frontZ = z; front = key(v); }
        if (z < backZ) { backZ = z; back = key(v); }
      }
    }
    expect(front).toBe("quad-left");
    expect(back).toBe("hamstring-left");
  });
});
