/**
 * Display vocabulary for the squad room. Kept apart from the domain unions in
 * `@/lib/types` so a label change never edits the values the database checks,
 * and shared by the server-rendered table and the client popover so a status
 * reads identically in both.
 */
import type { AvailabilityStatus, BodyRegion, Severity, Side } from "@/lib/types";
import type { LoadFlag } from "@/lib/load-engine";

/** Short, all-caps board label. The text does the work; colour only echoes it. */
export const STATUS_LABEL: Record<AvailabilityStatus, string> = {
  fit: "FIT",
  doubt: "DOUBT",
  injured: "OUT",
  suspended: "SUSP",
};

/** Sentence-case label for the popover's option list. */
export const STATUS_OPTION_LABEL: Record<AvailabilityStatus, string> = {
  fit: "fit",
  doubt: "doubt",
  injured: "injured",
  suspended: "suspended",
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  knock: "knock",
  minor: "minor",
  moderate: "moderate",
  severe: "severe",
};

export const SIDE_LABEL: Record<Side, string> = {
  left: "left",
  right: "right",
  central: "central",
};

export const BODY_REGION_LABEL: Record<BodyRegion, string> = {
  head: "head",
  neck: "neck",
  shoulder: "shoulder",
  arm: "arm",
  wrist_hand: "wrist / hand",
  chest: "chest",
  back_upper: "upper back",
  back_lower: "lower back",
  hip: "hip",
  groin: "groin",
  quad: "quad",
  hamstring: "hamstring",
  knee: "knee",
  calf: "calf",
  shin: "shin",
  achilles: "achilles",
  ankle: "ankle",
  foot: "foot",
};

/** Groups for the region <select>; every BODY_REGION appears exactly once. */
export const BODY_REGION_GROUPS: { label: string; regions: BodyRegion[] }[] = [
  { label: "head & trunk", regions: ["head", "neck", "chest", "back_upper", "back_lower"] },
  { label: "upper limb", regions: ["shoulder", "arm", "wrist_hand"] },
  { label: "hip & thigh", regions: ["hip", "groin", "quad", "hamstring"] },
  { label: "lower leg & foot", regions: ["knee", "calf", "shin", "achilles", "ankle", "foot"] },
];

/** Plain-English gloss of a load flag, so the dot is never colour-only. */
export const FLAG_LABEL: Record<LoadFlag, string> = {
  cold: "no load reading",
  ok: "load in range",
  watch: "load worth watching",
  red: "load spike",
};

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * `2026-08-19` -> `19 Aug`. Sliced, never `new Date()`: a date-only string
 * parsed as UTC and rendered in a local zone can slip a day.
 */
export function shortDate(iso: string): string {
  const month = MONTHS[Number(iso.slice(5, 7)) - 1];
  if (!month) return iso;
  return `${Number(iso.slice(8, 10))} ${month}`;
}

/** `2026-08-19` -> `19 Aug 2026`. */
export function longDate(iso: string): string {
  const month = MONTHS[Number(iso.slice(5, 7)) - 1];
  if (!month) return iso;
  return `${Number(iso.slice(8, 10))} ${month} ${iso.slice(0, 4)}`;
}

/** `0.462` -> `+46%`. Signed on purpose: the direction is the point. */
export function signedPct(fraction: number): string {
  const pct = Math.round(fraction * 100);
  return `${pct > 0 ? "+" : pct < 0 ? "-" : ""}${Math.abs(pct)}%`;
}
