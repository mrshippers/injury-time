/**
 * Shared, framework-free vocabulary for the player profile.
 *
 * Deliberately NOT a client module: the injury table, the header and the body
 * map all read these, and a `"use client"` module's exports come back
 * `undefined` when a Server Component imports them.
 */
import type { AvailabilityStatus, BodyRegion, Severity } from "@/lib/types";

/** Database enum -> the word a manager would actually say. */
export const REGION_LABEL: Record<BodyRegion, string> = {
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

export const SEVERITY_LABEL: Record<Severity, string> = {
  knock: "knock",
  minor: "minor",
  moderate: "moderate",
  severe: "severe",
};

/** Status word plus the condition token it is drawn in. */
export const STATUS_META: Record<
  AvailabilityStatus,
  { label: string; text: string; varName: string }
> = {
  fit: { label: "fit", text: "text-fit", varName: "var(--fit)" },
  doubt: { label: "doubt", text: "text-doubt", varName: "var(--doubt)" },
  injured: { label: "injured", text: "text-out", varName: "var(--out)" },
  suspended: { label: "suspended", text: "text-susp", varName: "var(--susp)" },
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** `2026-08-17` -> `17 Aug 26`. Pure string work: no Date, no zone. */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d} ${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

/** `2025-12-22` -> `Dec 2025`. */
export function formatMonthYear(iso: string): string {
  const [y, m] = iso.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/**
 * The glyph for "we have no reading". Written as an escape so the house
 * no-em-dash rule (which is about prose) does not rewrite a chart's null
 * marker into a weaker hyphen. It must never be a number.
 */
export const NO_VALUE = "\u2014";

const MS_PER_DAY = 86_400_000;

/** Whole days from `from` to `to`, never negative. */
export function daysBetween(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / MS_PER_DAY));
}

/**
 * Days a player has been out for one injury. An unresolved injury is counted
 * up to `asOf` - it is still running, so the number keeps climbing.
 */
export function daysOut(
  injury: { occurred_on: string; resolved_on: string | null },
  asOf: string,
): number {
  return daysBetween(injury.occurred_on, injury.resolved_on ?? asOf);
}
