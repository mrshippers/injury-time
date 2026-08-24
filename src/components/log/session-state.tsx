/**
 * Pure state and domain helpers for the session logger. No JSX, no hooks -
 * shared by SessionForm and PlayerRow without either importing a component
 * from the other.
 *
 * The model: one session-wide default (RPE + minutes) that every row
 * inherits, and per-row overrides only where a player differed. A normal
 * training night is one tap on the default and one on save.
 */
import type { AvailabilityStatus, Player, SessionKind } from "@/lib/types";

export type RosterPlayer = Player & { status: AvailabilityStatus | null };

export type SessionDefault = {
  rpe: number | null;
  minutes: number;
};

export type RowState = {
  /** null = inherit the session default */
  rpe: number | null;
  /** null = inherit the session default */
  minutes: number | null;
  absent: boolean;
  /** injured/suspended players start collapsed; a tap sets this true. */
  expanded: boolean;
  /** the inline editor is open for this row */
  open: boolean;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
};

export const MAX_GOALS = 5;
export const MIN_MINUTES = 5;
export const MAX_MINUTES = 150;

export function defaultMinutesFor(kind: SessionKind): number {
  return kind === "match" ? 90 : 60;
}

export function isOut(status: AvailabilityStatus | null): boolean {
  return status === "injured" || status === "suspended";
}

/**
 * A row counts toward the save unless marked absent, or it belongs to an
 * injured/suspended player still collapsed (physio hasn't opted them back in).
 */
export function isIncluded(status: AvailabilityStatus | null, row: RowState): boolean {
  if (row.absent) return false;
  if (isOut(status) && !row.expanded) return false;
  return true;
}

/** What will actually be saved for this row, once inheritance is resolved. */
export function effective(row: RowState, def: SessionDefault): { rpe: number | null; minutes: number } {
  return {
    rpe: row.rpe ?? def.rpe,
    minutes: row.minutes ?? def.minutes,
  };
}

export function initialRowState(): RowState {
  return {
    rpe: null,
    minutes: null,
    absent: false,
    expanded: false,
    open: false,
    goals: 0,
    assists: 0,
    yellow: 0,
    red: 0,
  };
}

export function clampMinutes(m: number): number {
  return Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, m));
}
