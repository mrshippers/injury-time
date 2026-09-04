"use client";

/**
 * Loads the converted body once per page and hands every figure the same
 * geometry: positions, smooth normals, an index, and one relative morph
 * attribute per measurement. Region classification runs once on the base
 * shape, scaled to the default athlete, so hover resolves before any morph.
 */
import * as THREE from "three";

import { DEFAULT_ATHLETE, MANIFEST, MORPHS, figureScale } from "./params";
import { classifyRegions, type RegionMap } from "./regions";

export type BodyAsset = {
  geometry: THREE.BufferGeometry;
  regions: RegionMap;
};

let pending: Promise<BodyAsset> | null = null;

export function loadBodyAsset(): Promise<BodyAsset> {
  if (!pending) {
    pending = fetch("/body/athlete.bin")
      .then((r) => {
        if (!r.ok) throw new Error(`body asset ${r.status}`);
        return r.arrayBuffer();
      })
      .then(build)
      .catch((e) => {
        pending = null;
        throw e;
      });
  }
  return pending;
}

function build(buf: ArrayBuffer): BodyAsset {
  const n = MANIFEST.vertexCount;
  const o = MANIFEST.offsets;
  const positions = new Float32Array(buf, o.positions, n * 3);
  const normals = new Float32Array(buf, o.normals, n * 3);
  const indices = new Uint16Array(buf, o.indices, MANIFEST.triangleCount * 3);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals.slice(), 3));
  geometry.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
  geometry.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));

  geometry.morphAttributes.position = MORPHS.map((m, k) => {
    const q = new Int16Array(buf, o.morphs + k * o.morphBytes, n * 3);
    const f = new Float32Array(n * 3);
    for (let i = 0; i < f.length; i += 1) f[i] = q[i] * m.scale;
    const attr = new THREE.BufferAttribute(f, 3);
    attr.name = m.name;
    return attr;
  });
  geometry.morphTargetsRelative = true;
  geometry.computeBoundingSphere();

  // classify at the default athlete's scale so the sculpt's balls line up
  const regions = classifyRegions(positions, n, undefined, figureScale(DEFAULT_ATHLETE));
  return { geometry, regions };
}
