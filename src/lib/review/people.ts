/**
 * End-of-season rows: one per player, one per member of staff. Each column
 * counts something the club logged. Where the data cannot support a column
 * the value is null (shown as a dash), never 0. Pure functions, no I/O.
 */
import type { SeasonStats } from "@/lib/stats";
import type { ClubStaff, Injury, Position } from "@/lib/types";

export type PlayerReviewRow = {
  id: string;
  name: string;
  number: number | null;
  position: Position | null;
  /** apps and goals from the log when there is one, else from the feed; the rest from the log only */
  apps: number;
  goals: number;
  /** null when nothing has been logged for him: the feed does not carry these */
  starts: number | null;
  minutes: number | null;
  assists: number | null;
  yellow: number | null;
  red: number | null;
  /** injury spells this season and the days they cost, counted to the return or to asOf */
  injuries: number;
  daysOut: number;
  source: "log" | "feed" | "none";
};

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.max(0, Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY));

export function playerRows(input: {
  players: readonly { id: string; name: string; squad_number: number | null; position: Position | null; external_stats: { apps?: number; goals?: number } | null }[];
  stats: ReadonlyMap<string, SeasonStats>;
  injuries: readonly Pick<Injury, "player_id" | "occurred_on" | "resolved_on" | "expected_return">[];
  asOf: string;
}): PlayerReviewRow[] {
  const hurt = new Map<string, { n: number; days: number }>();
  for (const i of input.injuries) {
    const end = i.resolved_on ?? (i.expected_return && i.expected_return < input.asOf ? i.expected_return : input.asOf);
    const h = hurt.get(i.player_id) ?? { n: 0, days: 0 };
    h.n += 1;
    h.days += daysBetween(i.occurred_on, end);
    hurt.set(i.player_id, h);
  }
  return input.players
    .map((p) => {
      const s = input.stats.get(p.id);
      const logged = Boolean(s && s.apps > 0);
      const feed = p.external_stats;
      const h = hurt.get(p.id) ?? { n: 0, days: 0 };
      return {
        id: p.id,
        name: p.name,
        number: p.squad_number,
        position: p.position,
        apps: logged ? s!.apps : (feed?.apps ?? 0),
        goals: logged ? s!.goals : (feed?.goals ?? 0),
        starts: logged ? s!.starts : null,
        minutes: logged ? s!.minutes : null,
        assists: logged ? s!.assists : null,
        yellow: logged ? s!.yellow : null,
        red: logged ? s!.red : null,
        injuries: h.n,
        daysOut: h.days,
        source: logged ? "log" : feed?.apps || feed?.goals ? "feed" : "none",
      } satisfies PlayerReviewRow;
    })
    .sort((a, b) => b.apps - a.apps || b.goals - a.goals || a.name.localeCompare(b.name));
}

export type StaffReviewRow = {
  id: string;
  name: string;
  title: string;
  role: ClubStaff["role"];
  joined_on: string;
  left_on: string | null;
  /** days in post, to asOf or the day they left */
  tenureDays: number;
};

export function staffRows(input: { staff: readonly ClubStaff[]; asOf: string }): StaffReviewRow[] {
  const ROLE_ORDER: Record<ClubStaff["role"], number> = { manager: 0, coach: 1, medical: 2, other: 3 };
  return input.staff
    .map((s) => {
      const to = s.left_on && s.left_on < input.asOf ? s.left_on : input.asOf;
      return {
        id: s.id,
        name: s.name,
        title: s.title,
        role: s.role,
        joined_on: s.joined_on,
        left_on: s.left_on,
        tenureDays: daysBetween(s.joined_on, to),
      } satisfies StaffReviewRow;
    })
    .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.joined_on.localeCompare(b.joined_on) || a.name.localeCompare(b.name));
}

/** Tenure as text: "2 yrs 3 mo", "8 mo", "3 wks". */
export function tenureWord(days: number): string {
  if (days < 21) return `${Math.max(1, Math.round(days / 7))} wk${Math.round(days / 7) === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.4);
  if (months < 12) return `${months} mo`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} yr${years === 1 ? "" : "s"} ${rest} mo` : `${years} yr${years === 1 ? "" : "s"}`;
}
