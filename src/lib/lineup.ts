/**
 * Formation shapes and the auto-pick. Pure: no React, no I/O.
 *
 * Coordinates are fractions of the pitch: `x` runs -1 (left touchline) to 1
 * (right touchline) as the side attacks up the screen, `depth` runs 0 (own
 * goal line) to 1 (their goal line). The 3D scene scales them to metres.
 */
import { READINESS_RANK } from "@/lib/readiness";
import type { SquadRow } from "@/lib/data";
import type { Position } from "@/lib/types";

export type Slot = { role: Position; x: number; depth: number };
export type Formation = { name: string; slots: Slot[] };

const BACK_FOUR: Slot[] = [
  { role: "DF", x: -0.78, depth: 0.26 },
  { role: "DF", x: -0.27, depth: 0.21 },
  { role: "DF", x: 0.27, depth: 0.21 },
  { role: "DF", x: 0.78, depth: 0.26 },
];
const GK: Slot = { role: "GK", x: 0, depth: 0.05 };

export const FORMATIONS: Formation[] = [
  {
    name: "4-4-2",
    slots: [
      GK,
      ...BACK_FOUR,
      { role: "MF", x: -0.78, depth: 0.52 },
      { role: "MF", x: -0.27, depth: 0.47 },
      { role: "MF", x: 0.27, depth: 0.47 },
      { role: "MF", x: 0.78, depth: 0.52 },
      { role: "FW", x: -0.34, depth: 0.76 },
      { role: "FW", x: 0.34, depth: 0.76 },
    ],
  },
  {
    name: "4-3-3",
    slots: [
      GK,
      ...BACK_FOUR,
      { role: "MF", x: -0.42, depth: 0.5 },
      { role: "MF", x: 0, depth: 0.43 },
      { role: "MF", x: 0.42, depth: 0.5 },
      { role: "FW", x: -0.64, depth: 0.74 },
      { role: "FW", x: 0, depth: 0.8 },
      { role: "FW", x: 0.64, depth: 0.74 },
    ],
  },
  {
    name: "3-5-2",
    slots: [
      GK,
      { role: "DF", x: -0.5, depth: 0.24 },
      { role: "DF", x: 0, depth: 0.2 },
      { role: "DF", x: 0.5, depth: 0.24 },
      { role: "MF", x: -0.88, depth: 0.52 },
      { role: "MF", x: -0.36, depth: 0.45 },
      { role: "MF", x: 0, depth: 0.54 },
      { role: "MF", x: 0.36, depth: 0.45 },
      { role: "MF", x: 0.88, depth: 0.52 },
      { role: "FW", x: -0.34, depth: 0.77 },
      { role: "FW", x: 0.34, depth: 0.77 },
    ],
  },
  {
    name: "4-2-3-1",
    slots: [
      GK,
      ...BACK_FOUR,
      { role: "MF", x: -0.25, depth: 0.4 },
      { role: "MF", x: 0.25, depth: 0.4 },
      { role: "MF", x: -0.62, depth: 0.62 },
      { role: "MF", x: 0, depth: 0.64 },
      { role: "MF", x: 0.62, depth: 0.62 },
      { role: "FW", x: 0, depth: 0.82 },
    ],
  },
];

export type Pick = {
  slot: Slot;
  row: SquadRow | null;
  /** filled from a neighbouring role because his own had nobody left */
  outOfPosition: boolean;
};

export type Lineup = {
  picks: Pick[];
  /** available but not picked, best first */
  bench: SquadRow[];
  /** injured, suspended, or a doubt: not selectable without a decision */
  unavailable: SquadRow[];
};

/** Who can cover for whom when a position runs dry. Keepers cover nobody. */
const COVER: Record<Position, Position[]> = {
  GK: [],
  DF: ["MF"],
  MF: ["DF", "FW"],
  FW: ["MF"],
};

/** Steadiest first, then squad number: a deterministic order for the picker. */
export function byForm(a: SquadRow, b: SquadRow): number {
  return (
    READINESS_RANK[a.readiness.key] - READINESS_RANK[b.readiness.key] ||
    (a.player.squad_number ?? 99) - (b.player.squad_number ?? 99)
  );
}

export function isAvailable(row: SquadRow): boolean {
  return (row.availability?.status ?? "fit") === "fit";
}

/**
 * Fill a formation from the fit players, best form first, own role first.
 * Never invents a player: a slot nobody can fill stays empty, which is the
 * honest answer when a club is short.
 */
export function pickXI(rows: SquadRow[], formation: Formation): Lineup {
  const available = rows.filter(isAvailable).sort(byForm);
  const unavailable = rows.filter((r) => !isAvailable(r));
  const pool = new Map<Position, SquadRow[]>([["GK", []], ["DF", []], ["MF", []], ["FW", []]]);
  for (const r of available) pool.get(r.player.position)!.push(r);

  const picks: Pick[] = [];
  // own-role pass first so a borrowed midfielder never displaces a real one
  for (const slot of formation.slots) {
    const own = pool.get(slot.role)!.shift() ?? null;
    picks.push({ slot, row: own, outOfPosition: false });
  }
  for (const pick of picks) {
    if (pick.row) continue;
    for (const cover of COVER[pick.slot.role]) {
      const borrowed = pool.get(cover)!.shift();
      if (borrowed) {
        pick.row = borrowed;
        pick.outOfPosition = true;
        break;
      }
    }
  }
  const bench = [...pool.values()].flat().sort(byForm);
  return { picks, bench, unavailable };
}
