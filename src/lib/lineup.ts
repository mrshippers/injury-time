/**
 * Formations and the auto-pick.
 *
 * A formation is a template from config (rows of outfield players from the
 * back) turned into eleven slots in pitch space: `x` runs -1 (own left) to 1,
 * `depth` runs 0 (own goal line) to 1 (their goal line). The keeper is
 * implied. Coordinates come from the row shape, so every template in the
 * dropdown lays out the same way and none of them is hand-placed.
 */
import { FORMATION_TEMPLATES, type FormationTemplate } from "@/lib/config";
import type { SquadRow } from "@/lib/data";
import { READINESS_RANK } from "@/lib/readiness";
import type { Position } from "@/lib/types";

export type Slot = { role: Position; x: number; depth: number };
export type Formation = { name: string; note: string; slots: Slot[] };

const GK: Slot = { role: "GK", x: 0, depth: 0.05 };
/** the back line and the front line, as a share of the pitch length */
const DEPTH_BACK = 0.22;
const DEPTH_FRONT = 0.8;
/** how far outward a wide player in a row of n sits */
const SPREAD: Record<number, number[]> = {
  1: [0],
  2: [-0.34, 0.34],
  3: [-0.6, 0, 0.6],
  4: [-0.78, -0.27, 0.27, 0.78],
  5: [-0.88, -0.44, 0, 0.44, 0.88],
  6: [-0.9, -0.54, -0.18, 0.18, 0.54, 0.9],
};

/**
 * Lay a template out. Rows are spread evenly from the back line to the front
 * line; within a row the wide players push forward in the defensive half
 * (full-backs, wing-backs) and hang back in the attacking half (wide
 * forwards behind the striker), which is how the shapes actually stand.
 */
export function formationFromTemplate(t: FormationTemplate): Formation {
  const n = t.rows.length;
  const slots: Slot[] = [GK];
  t.rows.forEach((count, i) => {
    const base = n === 1 ? DEPTH_FRONT : DEPTH_BACK + ((DEPTH_FRONT - DEPTH_BACK) * i) / (n - 1);
    const xs = SPREAD[count] ?? SPREAD[5];
    const arc = i < n / 2 ? 0.06 : -0.07;
    xs.forEach((x, j) => {
      const role = t.roles[i]?.[j] ?? "MF";
      slots.push({ role, x, depth: Math.round((base + arc * Math.abs(x)) * 1000) / 1000 });
    });
  });
  return { name: t.name, note: t.note, slots };
}

export const FORMATIONS: Formation[] = FORMATION_TEMPLATES.map(formationFromTemplate);

export function formationByName(name: string | null | undefined): Formation {
  return FORMATIONS.find((f) => f.name === name) ?? FORMATIONS[0];
}

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
  const ids = fillEmpty(rows, formation, formation.slots.map(() => null));
  const byId = new Map(rows.map((r) => [r.player.id, r]));
  const picks: Pick[] = formation.slots.map((slot, i) => {
    const row = ids[i] ? (byId.get(ids[i]!) ?? null) : null;
    return { slot, row, outOfPosition: !!row && row.player.position !== slot.role };
  });
  const inXI = new Set(ids.filter(Boolean) as string[]);
  const bench = rows.filter((r) => isAvailable(r) && !inXI.has(r.player.id)).sort(byForm);
  const unavailable = rows.filter((r) => !isAvailable(r));
  return { picks, bench, unavailable };
}

/**
 * "Pick for me": fill only the empty slots, from the fit players not already
 * on the pitch, own role first then a neighbouring one. A manual placement
 * is never overwritten.
 */
export function fillEmpty(rows: SquadRow[], formation: Formation, current: (string | null)[]): (string | null)[] {
  const next = formation.slots.map((_, i) => current[i] ?? null);
  const taken = new Set(next.filter(Boolean) as string[]);
  const available = rows.filter((r) => isAvailable(r) && !taken.has(r.player.id)).sort(byForm);
  const pool = new Map<Position, SquadRow[]>([["GK", []], ["DF", []], ["MF", []], ["FW", []]]);
  for (const r of available) pool.get(r.player.position)!.push(r);

  // own-role pass first so a borrowed midfielder never displaces a real one
  formation.slots.forEach((slot, i) => {
    if (next[i]) return;
    const own = pool.get(slot.role)!.shift();
    if (own) next[i] = own.player.id;
  });
  formation.slots.forEach((slot, i) => {
    if (next[i]) return;
    for (const cover of COVER[slot.role]) {
      const borrowed = pool.get(cover)!.shift();
      if (borrowed) {
        next[i] = borrowed.player.id;
        break;
      }
    }
  });
  return next;
}
