/**
 * The clay athlete, built once. The sculpt's balls become a scalar field, the
 * field becomes one smooth surface (marching cubes), and each vertex of that
 * surface is handed to the ball it is nearest, so the mesh knows which region
 * every point of skin belongs to. Pure three, no React, runs in node for tests.
 */
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { classifyRegions, type PartRef } from "@/lib/body/regions";

import { SCULPT, type Ball } from "./body-geometry";

export type { PartRef };

export type BodyMesh = {
  geometry: THREE.BufferGeometry;
  /** part index per vertex */
  vertexPart: Uint16Array;
  parts: PartRef[];
  /** vertex indices per part, for repainting one region at a time */
  partVerts: Uint32Array[];
  vertexCount: number;
};

export type BuildOptions = {
  /** grid cells per axis; 128 is a smooth figure, 48 is a fast test */
  resolution?: number;
  /** the field cube spans `centre ± scale` metres on every axis */
  scale?: number;
  centre?: [number, number, number];
  /** how quickly a ball's influence falls off: higher = tighter, more sculpted joins */
  subtract?: number;
  maxPolyCount?: number;
};

/**
 * Laplacian smoothing: each vertex eases toward the mean of its neighbours.
 * Marching cubes leaves the grid's stair-steps in the surface; three light
 * passes take them out without shrinking the limbs noticeably.
 */
function smooth(geometry: THREE.BufferGeometry, iterations: number, lambda: number): void {
  const index = geometry.getIndex();
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute;
  if (!index) return;
  const n = pos.count;
  const adj: number[][] = Array.from({ length: n }, () => []);
  const idx = index.array;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i];
    const b = idx[i + 1];
    const c = idx[i + 2];
    adj[a].push(b, c);
    adj[b].push(a, c);
    adj[c].push(a, b);
  }
  const src = pos.array as Float32Array<ArrayBufferLike>;
  let cur: Float32Array<ArrayBufferLike> = src;
  let next: Float32Array<ArrayBufferLike> = new Float32Array(src.length);
  for (let it = 0; it < iterations; it += 1) {
    for (let v = 0; v < n; v += 1) {
      const nb = adj[v];
      const o = v * 3;
      if (nb.length === 0) {
        next[o] = cur[o];
        next[o + 1] = cur[o + 1];
        next[o + 2] = cur[o + 2];
        continue;
      }
      let sx = 0;
      let sy = 0;
      let sz = 0;
      for (let k = 0; k < nb.length; k += 1) {
        const q = nb[k] * 3;
        sx += cur[q];
        sy += cur[q + 1];
        sz += cur[q + 2];
      }
      const inv = 1 / nb.length;
      next[o] = cur[o] + lambda * (sx * inv - cur[o]);
      next[o + 1] = cur[o + 1] + lambda * (sy * inv - cur[o + 1]);
      next[o + 2] = cur[o + 2] + lambda * (sz * inv - cur[o + 2]);
    }
    const tmp = cur;
    cur = next;
    next = tmp === src ? new Float32Array(src.length) : tmp;
  }
  if (cur !== src) src.set(cur);
  pos.needsUpdate = true;
}

export function buildBodyMesh(balls: Ball[] = SCULPT, opts: BuildOptions = {}): BodyMesh {
  const { resolution = 128, scale = 1, centre = [0, 0.9, 0], subtract = 40, maxPolyCount = 240_000 } = opts;

  const mc = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), false, false, maxPolyCount);
  mc.isolation = 80;
  for (const b of balls) {
    // metres -> the unit cube the field lives in
    const fx = (b.pos[0] - centre[0]) / (2 * scale) + 0.5;
    const fy = (b.pos[1] - centre[1]) / (2 * scale) + 0.5;
    const fz = (b.pos[2] - centre[2]) / (2 * scale) + 0.5;
    const rs = b.r / (2 * scale);
    // a lone ball's surface sits where strength / r^2 - subtract = isolation
    const strength = rs * rs * (mc.isolation + subtract);
    mc.addBall(fx, fy, fz, strength, subtract);
  }
  mc.update();

  const count = mc.count;
  const raw = (mc.positionArray as Float32Array).subarray(0, count * 3);
  const world = new Float32Array(raw.length);
  for (let i = 0; i < raw.length; i += 3) {
    world[i] = raw[i] * scale + centre[0];
    world[i + 1] = raw[i + 1] * scale + centre[1];
    world[i + 2] = raw[i + 2] * scale + centre[2];
  }
  mc.geometry.dispose();

  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(world, 3));
  geometry = mergeVertices(geometry, 1e-4);
  smooth(geometry, 3, 0.5);
  geometry.computeVertexNormals();

  const map = classifyRegions(geometry.getAttribute("position").array, geometry.getAttribute("position").count, balls);
  const { vertexPart, parts, partVerts, vertexCount } = map;

  // colour attribute the figure paints into; starts white so a missing paint is loud
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(vertexCount * 3).fill(1), 3));

  return { geometry, vertexPart, parts, partVerts, vertexCount };
}
