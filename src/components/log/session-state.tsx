/**
 * Pure state and domain helpers for the session logger. No JSX, no hooks -
 * shared by SessionForm and PlayerRow without either importing a component
 * from the other.
 */
import type { AvailabilityStatus, Player, SessionKind } from "@/lib/types";

export type RosterPlayer = Player & { status: AvailabilityStatus | null };

export type RowState = {
  minutes: number;
  /** true once the manager has picked a minutes value by hand - protects it
   * from being overwritten when the session kind's default changes. */
  minutesTouched: boolean;
  rpe: number | null;
  absent: boolean;
  /** injured/suspended players start collapsed; a tap sets this true. */
  expanded: boolean;
  stepperOpen: boolean;
};

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
export function isIncluded(
  status: AvailabilityStatus | null,
  row: RowState,
): boolean {
  if (row.absent) return false;
  if (isOut(status) && !row.expanded) return false;
  return true;
}

export function initialRowState(): RowState {
  return {
    minutes: defaultMinutesFor("training"),
    minutesTouched: false,
    rpe: null,
    absent: false,
    expanded: false,
    stepperOpen: false,
  };
}
