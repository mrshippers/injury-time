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
import { positionKnown } from "@/lib/squad/position";
import type { CallStatus, Position } from "@/lib/types";

/** `label` is the position in the dressing room's words (LB, DM, AM, ST), fixed when the formation is laid out. */
export type Slot = { role: Position; x: number; depth: number; label: string };
export type Formation = { name: string; note: string; slots: Slot[] };

const GK: Slot = { role: "GK", x: 0, depth: 0.05, label: "GK" };
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
  const rowsWith = (role: Position) => t.rows.map((_, i) => i).filter((i) => (t.roles[i] ?? []).some((r) => r === role));
  const mfRows = rowsWith("MF");
  const fwRows = rowsWith("FW");
  t.rows.forEach((count, i) => {
    const base = n === 1 ? DEPTH_FRONT : DEPTH_BACK + ((DEPTH_FRONT - DEPTH_BACK) * i) / (n - 1);
    const xs = SPREAD[count] ?? SPREAD[5];
    const arc = i < n / 2 ? 0.06 : -0.07;
    xs.forEach((x, j) => {
      const role = t.roles[i]?.[j] ?? "MF";
      slots.push({ role, x, depth: Math.round((base + arc * Math.abs(x)) * 1000) / 1000, label: labelFor(role, x, i, count, mfRows, fwRows) });
    });
  });
  return { name: t.name, note: t.note, slots };
}

/**
 * The position a slot asks for, in the words a dressing room uses. Read from the template's rows, not
 * from depth alone: the lowest of two midfield lines is the holding line (DM), a top line of three is the
 * line behind the striker (LW, AM, RW), a single line of four is LM, CM, CM, RM.
 */
function labelFor(role: Position, x: number, row: number, count: number, mfRows: number[], fwRows: number[]): string {
  const side = x < 0 ? "L" : "R";
  const wide = Math.abs(x);
  if (role === "GK") return "GK";
  if (role === "DF") return wide >= 0.7 ? `${side}B` : "CB";
  if (role === "MF") {
    const several = mfRows.length > 1;
    if (several && row === Math.min(...mfRows)) return wide >= 0.7 ? `${side}M` : count >= 3 && wide >= 0.2 ? "CM" : "DM";
    if (several && row === Math.max(...mfRows) && count <= 3) return wide >= 0.5 ? `${side}W` : "AM";
    return wide >= 0.7 ? `${side}M` : "CM";
  }
  // FW: a forward line with another above it is the line behind the striker
  if (fwRows.length > 1 && row !== Math.max(...fwRows)) return wide >= 0.5 ? `${side}W` : "AM";
  return wide >= 0.5 ? `${side}W` : "ST";
}

/** The position a slot asks for (LB, DM, AM, ST...). */
export function slotLabel(slot: Slot): string {
  return slot.label;
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

const goalsOf = (r: SquadRow): number => r.stats.goals || (r.player.external_stats as { goals?: number } | null)?.goals || 0;
const goalRate = (r: SquadRow): number => {
  const apps = appsOf(r);
  return apps > 0 ? goalsOf(r) / apps : 0;
};
const appsOf = (r: SquadRow): number => r.stats.apps || (r.player.external_stats as { apps?: number } | null)?.apps || 0;

/**
 * Steadiest first, then who has played most (a club with no training data still has appearances, and
 * the man with eighteen is a better default than the man with four), then squad number: a deterministic
 * order for the picker.
 */
export function byForm(a: SquadRow, b: SquadRow): number {
  return (
    READINESS_RANK[a.readiness.key] - READINESS_RANK[b.readiness.key] ||
    appsOf(b) - appsOf(a) ||
    (a.player.squad_number ?? 99) - (b.player.squad_number ?? 99)
  );
}

export function isAvailable(row: SquadRow): boolean {
  return (row.availability?.status ?? "fit") === "fit";
}

/** What the picker may lean on besides form: who played last time, and who has answered for this match. */
export type PickOpts = {
  /** last match's eleven: the side he would name again if nobody was missing */
  prefer?: ReadonlySet<string>;
  calls?: ReadonlyMap<string, CallStatus>;
};

const callRank = (c: CallStatus | undefined) => (c === "in" ? 0 : c === "unsure" ? 2 : 1);

/** Order the candidates: last time's eleven first, then who said in, then who has not said, then who is unsure, then form. */
function byChoice(opts: PickOpts) {
  return (a: SquadRow, b: SquadRow): number =>
    Number(!opts.prefer?.has(a.player.id)) - Number(!opts.prefer?.has(b.player.id)) ||
    callRank(opts.calls?.get(a.player.id)) - callRank(opts.calls?.get(b.player.id)) ||
    byForm(a, b);
}

/** Fit, and has not said he is out. */
function selectable(r: SquadRow, opts: PickOpts): boolean {
  return isAvailable(r) && opts.calls?.get(r.player.id) !== "out";
}

/**
 * Fill a formation from the fit players: last time's eleven first, then who said in, then form, own role
 * first. A player nobody has placed (position not set) fills any outfield slot once the known roles are
 * done, and is never marked out of position. Never invents a player: a slot nobody can fill stays empty,
 * which is the honest answer when a club is short.
 */
export function pickXI(rows: SquadRow[], formation: Formation, opts: PickOpts = {}): Lineup {
  const ids = fillEmpty(rows, formation, formation.slots.map(() => null), opts);
  const byId = new Map(rows.map((r) => [r.player.id, r]));
  const picks: Pick[] = formation.slots.map((slot, i) => {
    const row = ids[i] ? (byId.get(ids[i]!) ?? null) : null;
    return { slot, row, outOfPosition: !!row && positionKnown(row.player) && row.player.position !== slot.role };
  });
  const inXI = new Set(ids.filter(Boolean) as string[]);
  const bench = rows.filter((r) => selectable(r, opts) && !inXI.has(r.player.id)).sort(byChoice(opts));
  const unavailable = rows.filter((r) => !isAvailable(r));
  return { picks, bench, unavailable };
}

/**
 * Fill only the empty slots, from the selectable players not already on the pitch: own role first, then
 * anyone whose position is not set, then a neighbouring role. A manual placement is never overwritten.
 */
export function fillEmpty(rows: SquadRow[], formation: Formation, current: (string | null)[], opts: PickOpts = {}): (string | null)[] {
  const next = formation.slots.map((_, i) => current[i] ?? null);
  const taken = new Set(next.filter(Boolean) as string[]);
  const available = rows.filter((r) => selectable(r, opts) && !taken.has(r.player.id)).sort(byChoice(opts));
  const pool = new Map<Position, SquadRow[]>([["GK", []], ["DF", []], ["MF", []], ["FW", []]]);
  const flex: SquadRow[] = [];
  for (const r of available) (positionKnown(r.player) ? pool.get(r.player.position)! : flex).push(r);

  // a player with a named slot (a centre back is "CB", not just a defender) gets that slot before anyone else
  formation.slots.forEach((slot, i) => {
    if (next[i]) return;
    const list = pool.get(slot.role)!;
    const at = list.findIndex((r) => (r.player.external_stats as { slot?: string } | null)?.slot === slot.label);
    if (at >= 0) next[i] = list.splice(at, 1)[0].player.id;
  });
  // own-role pass first so a borrowed midfielder never displaces a real one
  formation.slots.forEach((slot, i) => {
    if (next[i]) return;
    const own = pool.get(slot.role)!.shift();
    if (own) next[i] = own.player.id;
  });
  // then the ones nobody has placed: any outfield slot, never the gloves. With no position to go on, goals a
  // game is the hint: the scorers go up front and the rest sit behind them. Only a default, one swap undoes it.
  const gaps = formation.slots.map((slot, i) => ({ slot, i })).filter((g) => !next[g.i] && g.slot.role !== "GK").sort((a, b) => a.slot.depth - b.slot.depth);
  const chosen = flex.slice(0, gaps.length).sort((a, b) => goalRate(a) - goalRate(b));
  gaps.forEach((g, j) => {
    if (chosen[j]) next[g.i] = chosen[j].player.id;
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
