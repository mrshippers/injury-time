/**
 * The static pitch, in metres. 105 x 68, seen from behind our own goal with
 * the side attacking up the screen (+z is their end). Chalk, goals and nets
 * are each one merged geometry, so the whole ground is a handful of draws.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const LENGTH = 105;
export const WIDTH = 68;
export const HALF_L = LENGTH / 2;
export const HALF_W = WIDTH / 2;
/** the grass runs past the lines, as it does */
export const APRON_W = WIDTH + 10;
export const APRON_L = LENGTH + 14;

const T = 0.12;
const LIFT = 0.025;

function arc(cx: number, cz: number, r: number, from: number, to: number, segments = 24): THREE.BufferGeometry {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const a = from + ((to - from) * i) / segments;
    pts.push(new THREE.Vector3(cx + Math.cos(a) * r, LIFT, cz + Math.sin(a) * r));
  }
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = a.distanceTo(b);
    const g = new THREE.BoxGeometry(T, 0.05, len + T * 0.5);
    const mid = a.clone().add(b).multiplyScalar(0.5);
    const angle = Math.atan2(b.x - a.x, b.z - a.z);
    g.rotateY(angle);
    g.translate(mid.x, LIFT, mid.z);
    parts.push(g);
  }
  return mergeGeometries(parts, false)!;
}

export function chalkGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const line = (x: number, z: number, w: number, d: number) => {
    const g = new THREE.BoxGeometry(w, 0.05, d);
    g.translate(x, LIFT, z);
    parts.push(g);
  };
  // touchlines, goal lines, halfway
  line(-HALF_W, 0, T, LENGTH);
  line(HALF_W, 0, T, LENGTH);
  line(0, -HALF_L, WIDTH, T);
  line(0, HALF_L, WIDTH, T);
  line(0, 0, WIDTH, T);
  for (const s of [-1, 1]) {
    const goalLine = s * HALF_L;
    // penalty area 40.3 x 16.5
    line(0, goalLine - s * 16.5, 40.3, T);
    line(-20.15, goalLine - s * 8.25, T, 16.5);
    line(20.15, goalLine - s * 8.25, T, 16.5);
    // six-yard 18.3 x 5.5
    line(0, goalLine - s * 5.5, 18.3, T);
    line(-9.15, goalLine - s * 2.75, T, 5.5);
    line(9.15, goalLine - s * 2.75, T, 5.5);
    // penalty spot
    const spot = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16);
    spot.translate(0, LIFT, goalLine - s * 11);
    parts.push(spot);
    // the D: the part of the 9.15 circle round the spot outside the area
    const spotZ = goalLine - s * 11;
    const half = Math.acos(5.5 / 9.15);
    const centreAngle = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    parts.push(arc(0, spotZ, 9.15, centreAngle - half, centreAngle + half, 18));
    // corner arcs
    for (const cx of [-HALF_W, HALF_W]) {
      const qx = cx < 0 ? 0 : Math.PI;
      const from = s > 0 ? -Math.PI / 2 : 0;
      const start = qx === 0 ? from : from + Math.PI / 2;
      parts.push(arc(cx, goalLine, 1, start, start + Math.PI / 2, 8));
    }
  }
  const ring = new THREE.RingGeometry(9.15 - T / 2, 9.15 + T / 2, 72);
  ring.rotateX(-Math.PI / 2);
  ring.translate(0, LIFT + 0.01, 0);
  parts.push(ring);
  const spot = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 16);
  spot.translate(0, LIFT, 0);
  parts.push(spot);
  return mergeGeometries(parts, false)!;
}

export function goalGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    const z = s * (HALF_L + 0.06);
    for (const x of [-3.66, 3.66]) {
      const post = new THREE.CylinderGeometry(0.06, 0.06, 2.44, 10);
      post.translate(x, 1.22, z);
      parts.push(post);
      // back stanchion
      const stan = new THREE.CylinderGeometry(0.04, 0.04, 2.0, 8);
      stan.translate(x, 1.0, z + s * 1.9);
      parts.push(stan);
    }
    const bar = new THREE.CylinderGeometry(0.06, 0.06, 7.32 + 0.12, 10);
    bar.rotateZ(Math.PI / 2);
    bar.translate(0, 2.44, z);
    parts.push(bar);
    const back = new THREE.CylinderGeometry(0.04, 0.04, 7.32 + 0.12, 8);
    back.rotateZ(Math.PI / 2);
    back.translate(0, 2.0, z + s * 1.9);
    parts.push(back);
  }
  return mergeGeometries(parts, false)!;
}

/** The nets as a wire grid: back, two sides and the roof, both goals. */
export function netGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const cell = 0.3;
  for (const s of [-1, 1]) {
    const z0 = s * (HALF_L + 0.06);
    const z1 = z0 + s * 1.9;
    // back wall
    for (let x = -3.66; x <= 3.66 + 1e-6; x += cell) pos.push(x, 0, z1, x, 2.0, z1);
    for (let y = 0; y <= 2.0 + 1e-6; y += cell) pos.push(-3.66, y, z1, 3.66, y, z1);
    // sides
    for (const x of [-3.66, 3.66]) {
      for (let y = 0; y <= 2.0 + 1e-6; y += cell) pos.push(x, y, z0, x, y, z1);
      for (let zz = 0; zz <= 1.9 + 1e-6; zz += cell) pos.push(x, 0, z0 + s * zz, x, 2.0 + (zz / 1.9) * 0.44 * 0, z0 + s * zz);
    }
    // roof, sloping from the bar down to the back
    for (let x = -3.66; x <= 3.66 + 1e-6; x += cell) pos.push(x, 2.44, z0, x, 2.0, z1);
    for (let zz = 0; zz <= 1.9 + 1e-6; zz += cell) {
      const y = 2.44 - (zz / 1.9) * 0.44;
      pos.push(-3.66, y, z0 + s * zz, 3.66, y, z0 + s * zz);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Slot coordinates (x -1..1, depth 0..1) to metres on the pitch. */
export function slotToWorld(x: number, depth: number): [number, number] {
  return [x * (HALF_W - 4), -HALF_L + depth * LENGTH];
}
