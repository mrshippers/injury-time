/**
 * The figure, as data. Every part is a smooth primitive (capsule, sphere, or
 * the front/back half of a capsule) placed in metres on a 1.8m body that
 * stands on y = 0 and faces +z. Front-of-body regions (chest, quad, shin) are
 * the +z half of a limb; back-of-body regions (upper back, hamstring, calf)
 * are the -z half of the same limb, so the seam between them is exact.
 *
 * Sides are the PLAYER's: his left is +x, because he faces the camera.
 */
import type { BodyRegion, Side } from "@/lib/types";

export type Shape =
  | { kind: "sphere"; r: number; scale?: [number, number, number] }
  | { kind: "capsule"; r: number; len: number; tilt?: [number, number, number] }
  | { kind: "half"; r: number; len: number; face: "front" | "back"; scale?: [number, number, number] };

export type Part = {
  region: BodyRegion | null;
  side: Side;
  shape: Shape;
  pos: [number, number, number];
};

/** A two-sided part: `x` is the player's left; the mirror is his right. */
function pair(region: BodyRegion | null, shape: Shape, pos: [number, number, number]): Part[] {
  const [x, y, z] = pos;
  const flip = (s: Shape): Shape =>
    s.kind === "capsule" && s.tilt ? { ...s, tilt: [s.tilt[0], s.tilt[1], -s.tilt[2]] } : s;
  return [
    { region, side: "left", shape, pos: [x, y, z] },
    { region, side: "right", shape: flip(shape), pos: [-x, y, z] },
  ];
}

export const PARTS: Part[] = [
  { region: "head", side: "central", shape: { kind: "sphere", r: 0.105, scale: [0.92, 1.12, 0.98] }, pos: [0, 1.67, 0] },
  { region: "neck", side: "central", shape: { kind: "capsule", r: 0.05, len: 0.08 }, pos: [0, 1.53, 0] },
  ...pair("shoulder", { kind: "sphere", r: 0.08, scale: [1.05, 0.92, 0.95] }, [0.18, 1.42, 0]),
  // trunk: chest is the front half, upper back the back half of one volume
  { region: "chest", side: "central", shape: { kind: "half", r: 0.165, len: 0.2, face: "front", scale: [1.15, 1, 0.72] }, pos: [0, 1.29, 0] },
  { region: "back_upper", side: "central", shape: { kind: "half", r: 0.165, len: 0.2, face: "back", scale: [1.15, 1, 0.72] }, pos: [0, 1.29, 0] },
  // lower trunk: front is drawn but no region of its own; the back is the lower back
  { region: null, side: "central", shape: { kind: "half", r: 0.135, len: 0.12, face: "front", scale: [1.1, 1, 0.72] }, pos: [0, 1.07, 0] },
  { region: "back_lower", side: "central", shape: { kind: "half", r: 0.135, len: 0.12, face: "back", scale: [1.1, 1, 0.72] }, pos: [0, 1.07, 0] },
  ...pair("hip", { kind: "sphere", r: 0.1, scale: [0.95, 0.9, 0.8] }, [0.095, 0.93, 0]),
  { region: "groin", side: "central", shape: { kind: "sphere", r: 0.062, scale: [1, 1.1, 0.8] }, pos: [0, 0.855, 0.03] },
  // arms: upper arm angled a touch outward, forearm forward
  ...pair("arm", { kind: "capsule", r: 0.052, len: 0.26, tilt: [0, 0, -0.14] }, [0.248, 1.25, 0]),
  ...pair("arm", { kind: "capsule", r: 0.044, len: 0.24, tilt: [-0.12, 0, -0.05] }, [0.283, 0.985, 0.03]),
  ...pair("wrist_hand", { kind: "capsule", r: 0.04, len: 0.11, tilt: [-0.1, 0, 0] }, [0.298, 0.795, 0.06]),
  // thigh: quad front, hamstring back
  ...pair("quad", { kind: "half", r: 0.088, len: 0.3, face: "front" }, [0.112, 0.665, 0]),
  ...pair("hamstring", { kind: "half", r: 0.088, len: 0.3, face: "back" }, [0.112, 0.665, 0]),
  ...pair("knee", { kind: "sphere", r: 0.084, scale: [1, 1.08, 0.98] }, [0.112, 0.47, 0]),
  // lower leg: shin front, calf back (a little fuller)
  ...pair("shin", { kind: "half", r: 0.06, len: 0.29, face: "front" }, [0.112, 0.27, 0.004]),
  ...pair("calf", { kind: "half", r: 0.07, len: 0.27, face: "back", scale: [1, 1, 1.15] }, [0.112, 0.285, -0.004]),
  ...pair("achilles", { kind: "half", r: 0.036, len: 0.1, face: "back" }, [0.112, 0.11, -0.03]),
  ...pair("ankle", { kind: "sphere", r: 0.058, scale: [1, 1.05, 1] }, [0.112, 0.095, 0.008]),
  ...pair("foot", { kind: "capsule", r: 0.042, len: 0.15, tilt: [Math.PI / 2, 0, 0] }, [0.112, 0.04, 0.085]),
];

/** Regions that live on the back of the figure: the body turns to show them. */
export const BACK_REGIONS: ReadonlySet<BodyRegion> = new Set<BodyRegion>([
  "back_upper",
  "back_lower",
  "hamstring",
  "calf",
  "achilles",
]);

export function partKey(p: Pick<Part, "region" | "side">): string {
  return `${p.region ?? "filler"}-${p.side}`;
}

/* ── the clay sculpt ──────────────────────────────────────────────
   PARTS above is the vocabulary: which regions exist, where they sit,
   what a chip points at. The figure itself is no longer built from those
   primitives. It is one continuous surface, the union of the balls below,
   so shoulders flow into arms and the calf is a calf, not a capsule.
   Every ball carries the region it belongs to; a vertex of the finished
   surface belongs to whichever ball it is nearest, so a hover on the
   surface resolves to a region exactly, seam or no seam. */

export type Ball = {
  region: BodyRegion | null;
  side: Side;
  /** centre, metres, same frame as PARTS */
  pos: [number, number, number];
  /** radius of the ball on its own, metres */
  r: number;
};

function ball(region: BodyRegion | null, side: Side, pos: [number, number, number], r: number): Ball {
  return { region, side, pos, r };
}

/**
 * `n` balls from `from` to `to`, radius easing from `rFrom` to `rTo`.
 * `bulge` swells the middle of the run (a bicep, a calf) by that fraction.
 */
function chain(
  region: BodyRegion | null,
  side: Side,
  from: [number, number, number],
  to: [number, number, number],
  rFrom: number,
  rTo: number,
  n: number,
  bulge = 0,
): Ball[] {
  const out: Ball[] = [];
  for (let i = 0; i < n; i += 1) {
    const t = n === 1 ? 0 : i / (n - 1);
    const pos: [number, number, number] = [
      from[0] + (to[0] - from[0]) * t,
      from[1] + (to[1] - from[1]) * t,
      from[2] + (to[2] - from[2]) * t,
    ];
    const r = (rFrom + (rTo - rFrom) * t) * (1 + bulge * Math.sin(Math.PI * t));
    out.push(ball(region, side, pos, r));
  }
  return out;
}

/** Everything off the midline gets its mirror; a `left` ball's mirror is `right`. */
function mirror(balls: Ball[]): Ball[] {
  const out: Ball[] = [];
  for (const b of balls) {
    out.push(b);
    if (b.pos[0] !== 0) {
      out.push({ ...b, side: b.side === "left" ? "right" : b.side, pos: [-b.pos[0], b.pos[1], b.pos[2]] });
    }
  }
  return out;
}

const LEG = 0.128;

export const SCULPT: Ball[] = [
  // head: a tall oval with a jaw, on a real neck
  ball("head", "central", [0, 1.705, 0], 0.094),
  ball("head", "central", [0, 1.655, 0.006], 0.09),
  ball("head", "central", [0, 1.605, 0.022], 0.062),
  ...chain("neck", "central", [0, 1.56, -0.004], [0, 1.505, -0.01], 0.05, 0.058, 3),

  // shoulders: a low trapezius line, a deltoid cap out wide
  ...mirror([
    ball("shoulder", "left", [0.105, 1.462, -0.015], 0.058),
    ball("shoulder", "left", [0.212, 1.432, 0], 0.086),
    ball("shoulder", "left", [0.236, 1.392, 0.012], 0.062),
  ]),

  // chest: pecs forward, the sternum between, ribs easing to the waist
  ...mirror([ball("chest", "central", [0.09, 1.36, 0.055], 0.088)]),
  ball("chest", "central", [0, 1.305, 0.052], 0.102),
  ball("chest", "central", [0, 1.225, 0.042], 0.094),

  // upper back: lats out wide, spine up the middle
  ...mirror([ball("back_upper", "central", [0.115, 1.315, -0.055], 0.098)]),
  ball("back_upper", "central", [0, 1.385, -0.06], 0.096),
  ball("back_upper", "central", [0, 1.245, -0.05], 0.09),

  // waist: the front has no region of its own; the back is the lower back
  ball(null, "central", [0, 1.135, 0.035], 0.098),
  ball(null, "central", [0, 1.05, 0.03], 0.098),
  ball("back_lower", "central", [0, 1.12, -0.045], 0.09),
  ball("back_lower", "central", [0, 1.03, -0.045], 0.092),

  // hips and glutes, narrower than the shoulders, then the groin
  ...mirror([
    ball("hip", "left", [0.088, 0.965, 0.01], 0.088),
    ball("hip", "left", [0.08, 0.925, -0.058], 0.084),
  ]),
  ball("groin", "central", [0, 0.87, 0.028], 0.058),

  // arms: hanging with a soft bend and a gap from the hips; fingertips at mid-thigh
  ...mirror([
    ...chain("arm", "left", [0.25, 1.385, 0], [0.288, 1.13, -0.012], 0.058, 0.046, 7, 0.12),
    ...chain("arm", "left", [0.29, 1.11, 0], [0.308, 0.86, 0.05], 0.048, 0.034, 7, 0.08),
    ...chain("wrist_hand", "left", [0.31, 0.835, 0.06], [0.315, 0.69, 0.085], 0.036, 0.028, 4),
  ]),

  // legs: quad on the front, hamstring behind, a knee, shin and a real calf
  ...mirror([
    ...chain("quad", "left", [LEG - 0.01, 0.9, 0.032], [LEG + 0.004, 0.53, 0.02], 0.082, 0.064, 6, 0.06),
    ...chain("hamstring", "left", [LEG - 0.012, 0.89, -0.036], [LEG, 0.53, -0.03], 0.078, 0.058, 6, 0.08),
    ball("knee", "left", [LEG + 0.003, 0.48, 0.005], 0.064),
    ...chain("shin", "left", [LEG, 0.44, 0.02], [LEG, 0.13, 0.015], 0.05, 0.038, 6),
    ...chain("calf", "left", [LEG, 0.42, -0.03], [LEG, 0.17, -0.03], 0.048, 0.034, 6, 0.5),
    ball("achilles", "left", [LEG, 0.1, -0.034], 0.027),
    ball("ankle", "left", [LEG, 0.075, 0], 0.043),
    ...chain("foot", "left", [LEG, 0.036, 0.03], [LEG + 0.01, 0.03, 0.19], 0.04, 0.036, 5),
  ]),
];
