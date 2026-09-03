import { describe, expect, it } from "vitest";
import { BODY_REGIONS } from "../../src/lib/types";
import { SCULPT } from "../../src/components/player/body-geometry";
import { buildBodyMesh } from "../../src/components/player/body-mesh";

describe("clay athlete mesh", () => {
  const t0 = performance.now();
  const mesh = buildBodyMesh(SCULPT, { resolution: 64 });
  const ms = performance.now() - t0;

  it("builds one closed surface the size of a person, in reasonable time", () => {
    expect(mesh.vertexCount).toBeGreaterThan(2000);
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    expect(bb.min.y).toBeGreaterThan(-0.05);
    expect(bb.max.y).toBeGreaterThan(1.7);
    expect(bb.max.y).toBeLessThan(1.9);
    expect(bb.max.x).toBeLessThan(0.45);
    expect(ms).toBeLessThan(2000);
  });

  it("every region the database accepts owns some skin, on both sides where it has sides", () => {
    const owned = new Set(mesh.parts.filter((_, i) => mesh.partVerts[i].length > 0).map((p) => p.key));
    for (const r of BODY_REGIONS) {
      const has = [...owned].some((k) => k.startsWith(`${r}-`));
      expect(has, `no skin for ${r}`).toBe(true);
    }
    for (const r of ["quad", "hamstring", "calf", "shin", "knee", "ankle", "foot", "arm", "wrist_hand", "shoulder", "hip"]) {
      expect(owned.has(`${r}-left`), `${r}-left`).toBe(true);
      expect(owned.has(`${r}-right`), `${r}-right`).toBe(true);
    }
  });

  it("the front of a thigh is quad and the back is hamstring", () => {
    const pos = mesh.geometry.getAttribute("position");
    const key = (v: number) => mesh.parts[mesh.vertexPart[v]].key;
    let front: string | null = null;
    let back: string | null = null;
    for (let v = 0; v < mesh.vertexCount; v += 1) {
      const x = pos.getX(v);
      const y = pos.getY(v);
      const z = pos.getZ(v);
      if (Math.abs(x - 0.115) < 0.03 && Math.abs(y - 0.7) < 0.03) {
        if (z > 0.06) front = key(v);
        if (z < -0.06) back = key(v);
      }
    }
    expect(front).toBe("quad-left");
    expect(back).toBe("hamstring-left");
  });
});
