/**
 * Measurements to morph influences. The model (OpnTec BodyApps, see
 * THIRD_PARTY_NOTICES.md) exposes twelve body morphs with a default, a low and
 * a high in its own units; the app stores every measurement in cm and maps
 * with the model's own formula: (value - default) / (high - low).
 *
 * Pure: no three, no DOM. Safe on the server and in tests.
 */
import manifest from "../../../public/body/athlete.json";

import type { BodyParams } from "@/lib/types";

export type MorphMeta = {
  key: keyof BodyParams;
  name: string;
  label: string;
  unit: "cm" | "in";
  scale: number;
  default: number;
  low: number;
  high: number;
  topDelta: number;
};

export type BodyManifest = {
  source: string;
  vertexCount: number;
  triangleCount: number;
  baseHeight: number;
  topVertex: number;
  offsets: { positions: number; normals: number; indices: number; morphs: number; morphBytes: number };
  morphs: MorphMeta[];
};

export const MANIFEST = manifest as unknown as BodyManifest;
export const MORPHS: readonly MorphMeta[] = MANIFEST.morphs;

const IN_TO_CM = 2.54;

/** A morph's range in cm, whatever the model's own unit. */
export function rangeCm(m: MorphMeta): { min: number; max: number; default: number } {
  const k = m.unit === "in" ? IN_TO_CM : 1;
  // the model stops at 190 cm; keepers do not, and the height morph
  // extrapolates cleanly, so the app allows up to 205
  const max = m.key === "height" ? Math.max(m.high * k, 205) : m.high * k;
  return { min: m.low * k, max, default: m.default * k };
}

/**
 * The default athlete: a 1.80 m outfield player. Everything the model does
 * not name stays at the model's own default.
 */
export const DEFAULT_ATHLETE: Required<Pick<BodyParams, "height" | "chest" | "waist" | "hips" | "upper_arm" | "thigh">> & BodyParams = {
  height: 180,
  chest: 100,
  waist: 82,
  hips: 100,
  upper_arm: 32,
  thigh: 56,
};

/** Every measurement, filled from the player then the default athlete then the model. */
export function resolveParams(params: BodyParams | null | undefined): Required<BodyParams> {
  const out = {} as Required<BodyParams>;
  for (const m of MORPHS) {
    const r = rangeCm(m);
    const v = params?.[m.key] ?? DEFAULT_ATHLETE[m.key] ?? r.default;
    out[m.key] = clamp(v, r.min, r.max);
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Morph influences in manifest order, from cm. */
export function influencesFor(params: BodyParams | null | undefined): number[] {
  const p = resolveParams(params);
  return MORPHS.map((m) => {
    const value = m.unit === "in" ? p[m.key] / IN_TO_CM : p[m.key];
    const span = m.high - m.low || 1;
    return (value - m.default) / span;
  });
}

/**
 * Uniform scale that makes the figure exactly `height` cm tall once the
 * influences are applied: the crown vertex moves with height, arm length and
 * lower-leg length, and the manifest carries how far.
 */
export function figureScale(params: BodyParams | null | undefined): number {
  const p = resolveParams(params);
  const inf = influencesFor(params);
  let top = MANIFEST.baseHeight;
  MORPHS.forEach((m, i) => {
    top += inf[i] * m.topDelta;
  });
  return p.height / 100 / top;
}

/** True when the player carries any measurement of their own. */
export function hasOwnParams(params: BodyParams | null | undefined): boolean {
  return Boolean(params && Object.values(params).some((v) => typeof v === "number"));
}
