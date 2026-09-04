/**
 * Convert the OpnTec BodyApps male base body (three.js JSON 3.1, LGPL-3.0)
 * into a compact binary the figure can load: positions, smooth normals,
 * triangle indices and a set of morph deltas quantised to int16.
 *
 *   npx tsx scripts/convert-body.ts
 *
 * Frame on output: metres, feet on y = 0, facing +z (the model already does),
 * the torso centred on z = 0, the model's own default (160 cm) as the base
 * height. The app rescales the whole figure so the height slider is true.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const SRC = process.env.BODY_SRC ?? "/Users/joa/.claude/jobs/274c02a9/tmp/bodyapps/models/skinned/UCS/basis.js";
const CFG = process.env.BODY_CFG ?? "/Users/joa/.claude/jobs/274c02a9/tmp/bodyapps/models/skinned/testconfig.json";
const OUT_DIR = "public/body";

type Json = {
  vertices: number[];
  faces: number[];
  normals: number[];
  uvs: number[][];
  morphTargets: { name: string; vertices: number[] }[];
};
type Cfg = { morphs: string[]; morphslimit: number[]; morphslowlimit: number[]; morphshighlimit: number[] };

/** BodyParams key -> morph name, with the label and unit the editor shows. */
const KEEP: { key: string; morph: string; label: string; unit: "cm" | "in" }[] = [
  { key: "height", morph: "height", label: "body height", unit: "cm" },
  { key: "chest", morph: "chest", label: "chest", unit: "cm" },
  { key: "neck", morph: "neck", label: "neck girth", unit: "cm" },
  { key: "shoulders", morph: "shoulders", label: "shoulders", unit: "in" },
  { key: "waist", morph: "waist", label: "waist", unit: "cm" },
  { key: "hips", morph: "hips", label: "hips", unit: "cm" },
  { key: "arm_length", morph: "arm_length", label: "arm length", unit: "in" },
  { key: "upper_arm", morph: "armgirth", label: "upper arm", unit: "cm" },
  { key: "wrist", morph: "wrist_girth", label: "wrist", unit: "cm" },
  { key: "thigh", morph: "thigh_girth", label: "thigh", unit: "cm" },
  { key: "lower_leg", morph: "lowerleg_length", label: "lower leg", unit: "cm" },
  { key: "calf", morph: "calf_girth", label: "calf", unit: "cm" },
];

const src = JSON.parse(readFileSync(SRC, "utf8")) as Json;
const cfg = JSON.parse(readFileSync(CFG, "utf8")) as Cfg;
const n = src.vertices.length / 3;

// ── frame ────────────────────────────────────────────────────────────────
let ymin = Infinity;
let ymax = -Infinity;
for (let i = 0; i < n; i += 1) {
  const y = src.vertices[i * 3 + 1];
  if (y < ymin) ymin = y;
  if (y > ymax) ymax = y;
}
const BASE_HEIGHT_M = 1.6; // the model's default is 160 cm
const S = BASE_HEIGHT_M / (ymax - ymin);
// torso centre in z: vertices between 9 and 12 units up, near the midline
let zs = 0;
let zc = 0;
for (let i = 0; i < n; i += 1) {
  const x = src.vertices[i * 3];
  const y = src.vertices[i * 3 + 1];
  if (y > 9 && y < 12 && Math.abs(x) < 1.5) {
    zs += src.vertices[i * 3 + 2];
    zc += 1;
  }
}
const zOff = zs / zc;

const positions = new Float32Array(n * 3);
let topVertex = 0;
for (let i = 0; i < n; i += 1) {
  positions[i * 3] = src.vertices[i * 3] * S;
  positions[i * 3 + 1] = (src.vertices[i * 3 + 1] - ymin) * S;
  positions[i * 3 + 2] = (src.vertices[i * 3 + 2] - zOff) * S;
  if (positions[i * 3 + 1] > positions[topVertex * 3 + 1]) topVertex = i;
}

// ── faces: bitmask-typed, quads split into two triangles ────────────────
const tris: number[] = [];
const fileNormalDot: number[] = [];
const f = src.faces;
const uvLayers = src.uvs.length;
let i = 0;
while (i < f.length) {
  const type = f[i];
  i += 1;
  const quad = (type & 1) !== 0;
  const nv = quad ? 4 : 3;
  const idx = f.slice(i, i + nv);
  i += nv;
  if (type & 2) i += 1;
  if (type & 4) i += uvLayers;
  if (type & 8) i += nv * uvLayers;
  let faceNormal: number | null = null;
  if (type & 16) {
    faceNormal = f[i];
    i += 1;
  }
  let vertexNormals: number[] | null = null;
  if (type & 32) {
    vertexNormals = f.slice(i, i + nv);
    i += nv;
  }
  if (type & 64) i += 1;
  if (type & 128) i += nv;

  const push = (a: number, b: number, c: number) => {
    tris.push(a, b, c);
    // compare our winding's normal with the file's, to catch a flipped export
    const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
    const bx = positions[b * 3] - ax, by = positions[b * 3 + 1] - ay, bz = positions[b * 3 + 2] - az;
    const cx = positions[c * 3] - ax, cy = positions[c * 3 + 1] - ay, cz = positions[c * 3 + 2] - az;
    const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
    const ref = vertexNormals ? vertexNormals[0] : faceNormal;
    if (ref !== null && ref !== undefined) {
      const rx = src.normals[ref * 3], ry = src.normals[ref * 3 + 1], rz = src.normals[ref * 3 + 2];
      fileNormalDot.push(nx * rx + ny * ry + nz * rz);
    }
  };
  push(idx[0], idx[1], idx[2]);
  if (quad) push(idx[0], idx[2], idx[3]);
}
const agree = fileNormalDot.filter((d) => d > 0).length / Math.max(1, fileNormalDot.length);
const indices = Uint16Array.from(tris);
if (agree < 0.5) {
  // the file winds the other way: flip every triangle
  for (let t = 0; t < indices.length; t += 3) {
    const b = indices[t + 1];
    indices[t + 1] = indices[t + 2];
    indices[t + 2] = b;
  }
}

// ── smooth normals, area weighted ───────────────────────────────────────
const normals = new Float32Array(n * 3);
for (let t = 0; t < indices.length; t += 3) {
  const a = indices[t], b = indices[t + 1], c = indices[t + 2];
  const ax = positions[a * 3], ay = positions[a * 3 + 1], az = positions[a * 3 + 2];
  const bx = positions[b * 3] - ax, by = positions[b * 3 + 1] - ay, bz = positions[b * 3 + 2] - az;
  const cx = positions[c * 3] - ax, cy = positions[c * 3 + 1] - ay, cz = positions[c * 3 + 2] - az;
  const nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx;
  for (const v of [a, b, c]) {
    normals[v * 3] += nx;
    normals[v * 3 + 1] += ny;
    normals[v * 3 + 2] += nz;
  }
}
for (let v = 0; v < n; v += 1) {
  const x = normals[v * 3], y = normals[v * 3 + 1], z = normals[v * 3 + 2];
  const l = Math.hypot(x, y, z) || 1;
  normals[v * 3] = x / l;
  normals[v * 3 + 1] = y / l;
  normals[v * 3 + 2] = z / l;
}

// ── morph deltas, int16 with a per-morph scale ──────────────────────────
const morphs: { key: string; name: string; label: string; unit: string; scale: number; default: number; low: number; high: number; topDelta: number }[] = [];
const morphBuffers: Int16Array[] = [];
for (const k of KEEP) {
  const mi = src.morphTargets.findIndex((m) => m.name === k.morph);
  if (mi < 0) throw new Error(`morph ${k.morph} missing`);
  const ci = cfg.morphs.findIndex((name) => name.toLowerCase().replace(/[^a-z]/g, "") === k.morph.replace(/_/g, "").replace("girth", k.morph === "bust_girth" ? "girth" : "").replace("armgirth", "upperarmgirth").replace("wrist", "wrist").replace("hips", "hipgirth").replace("thigh", "thighgirth").replace("calf", "calf").replace("lowerleglength", "lowerleglength").replace("neck", "neckgirth"));
  // the config lists morphs in the same order as the mesh; use that, it is exact
  const order = src.morphTargets.findIndex((m) => m.name === k.morph);
  void ci;
  const mv = src.morphTargets[mi].vertices;
  const delta = new Float32Array(n * 3);
  let maxAbs = 0;
  for (let j = 0; j < n; j += 1) {
    const dx = (mv[j * 3] - src.vertices[j * 3]) * S;
    const dy = (mv[j * 3 + 1] - src.vertices[j * 3 + 1]) * S;
    const dz = (mv[j * 3 + 2] - src.vertices[j * 3 + 2]) * S;
    delta[j * 3] = dx;
    delta[j * 3 + 1] = dy;
    delta[j * 3 + 2] = dz;
    maxAbs = Math.max(maxAbs, Math.abs(dx), Math.abs(dy), Math.abs(dz));
  }
  const scale = maxAbs / 32767 || 1;
  const q = new Int16Array(n * 3);
  for (let j = 0; j < q.length; j += 1) q[j] = Math.round(delta[j] / scale);
  morphBuffers.push(q);
  morphs.push({
    key: k.key,
    name: k.morph,
    label: k.label,
    unit: k.unit,
    scale,
    default: cfg.morphslimit[order],
    low: cfg.morphslowlimit[order],
    high: cfg.morphshighlimit[order],
    topDelta: delta[topVertex * 3 + 1],
  });
}

// ── pack ────────────────────────────────────────────────────────────────
const align = (x: number) => Math.ceil(x / 4) * 4;
const offPos = 0;
const offNorm = offPos + positions.byteLength;
const offIdx = offNorm + normals.byteLength;
const offMorph = align(offIdx + indices.byteLength);
const morphBytes = n * 3 * 2;
const total = offMorph + morphBytes * morphBuffers.length;
const out = new Uint8Array(total);
out.set(new Uint8Array(positions.buffer), offPos);
out.set(new Uint8Array(normals.buffer), offNorm);
out.set(new Uint8Array(indices.buffer), offIdx);
morphBuffers.forEach((m, k) => out.set(new Uint8Array(m.buffer), offMorph + k * morphBytes));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/athlete.bin`, out);
writeFileSync(
  `${OUT_DIR}/athlete.json`,
  JSON.stringify(
    {
      source: "OpnTec/bodyapps-viz basis.js (LGPL-3.0)",
      vertexCount: n,
      triangleCount: indices.length / 3,
      baseHeight: BASE_HEIGHT_M,
      topVertex,
      offsets: { positions: offPos, normals: offNorm, indices: offIdx, morphs: offMorph, morphBytes },
      morphs,
      windingFlipped: agree < 0.5,
    },
    null,
    1,
  ),
);
console.log(`vertices ${n}, triangles ${indices.length / 3}, morphs ${morphs.length}, ${(total / 1024).toFixed(0)} KB, winding agree ${(agree * 100).toFixed(0)}%, top vertex ${topVertex} at ${positions[topVertex * 3 + 1].toFixed(3)} m`);
