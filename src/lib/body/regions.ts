/**
 * Which region a point of skin belongs to. The sculpt in body-geometry.ts is
 * kept as the region map: every vertex goes to the ball whose surface it is
 * nearest, so a hover on the loaded mesh resolves to "hamstring, right" the
 * same way it did on the clay. Pure; runs in node for tests.
 */
import type { BodyRegion, Side } from "@/lib/types";

import { SCULPT, partKey, type Ball } from "@/components/player/body-geometry";

export type PartRef = {
  key: string;
  region: BodyRegion | null;
  side: Side;
  /** mean of the part's balls: where a tooltip anchors */
  centre: [number, number, number];
};

export type RegionMap = {
  /** part index per vertex */
  vertexPart: Uint16Array;
  parts: PartRef[];
  /** vertex indices per part, for repainting one region at a time */
  partVerts: Uint32Array[];
  vertexCount: number;
};

/**
 * `positions` is a flat xyz array in the shared frame (metres, feet on y = 0,
 * facing +z, the player's left at +x). Pass `scale` if the array is in a
 * frame that needs a uniform scale to match the sculpt.
 */
export function classifyRegions(positions: ArrayLike<number>, vertexCount: number, balls: readonly Ball[] = SCULPT, scale = 1): RegionMap {
  const partIndex = new Map<string, number>();
  const parts: PartRef[] = [];
  const sums: number[][] = [];
  const ballPart = new Uint16Array(balls.length);
  balls.forEach((b, i) => {
    const key = partKey(b);
    let idx = partIndex.get(key);
    if (idx === undefined) {
      idx = parts.length;
      partIndex.set(key, idx);
      parts.push({ key, region: b.region, side: b.side, centre: [0, 0, 0] });
      sums.push([0, 0, 0, 0]);
    }
    ballPart[i] = idx;
    const s = sums[idx];
    s[0] += b.pos[0];
    s[1] += b.pos[1];
    s[2] += b.pos[2];
    s[3] += 1;
  });
  parts.forEach((p, i) => {
    const s = sums[i];
    p.centre = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
  });

  const vertexPart = new Uint16Array(vertexCount);
  const buckets: number[][] = parts.map(() => []);
  for (let v = 0; v < vertexCount; v += 1) {
    const x = positions[v * 3] * scale;
    const y = positions[v * 3 + 1] * scale;
    const z = positions[v * 3 + 2] * scale;
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < balls.length; i += 1) {
      const b = balls[i];
      const dx = x - b.pos[0];
      const dy = y - b.pos[1];
      const dz = z - b.pos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - b.r;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    const p = ballPart[best];
    vertexPart[v] = p;
    buckets[p].push(v);
  }
  return { vertexPart, parts, partVerts: buckets.map((b) => Uint32Array.from(b)), vertexCount };
}
