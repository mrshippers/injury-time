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
