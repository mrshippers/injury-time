/**
 * One season shape, whatever fed it. Both providers (the Football Web Pages
 * API and the committed snapshot) come through here, so the pages, the seed
 * and the refresh all see the same rows. Pure: no I/O, no Supabase, runs in
 * node for the seed script and in vitest.
 */
import type { ProgressPoint, Result, Standing, Venue } from "@/lib/types";

export type SeasonResult = Omit<Result, "id" | "club_id" | "created_at">;
export type SeasonFixture = {
  match_date: string;
  kickoff: string | null;
  opponent: string;
  venue: Venue;
  competition: string;
};
export type SeasonStanding = Omit<Standing, "id" | "club_id">;
export type SeasonProgress = Omit<ProgressPoint, "id" | "club_id">;

export type SeasonData = {
  /** the club's name as the feed spells it */
  team: string;
  asOf: string;
  results: SeasonResult[];
  fixtures: SeasonFixture[];
  standings: SeasonStanding[];
  progress: SeasonProgress[];
  appearances: { name: string; apps: number }[];
  /** goals by scorer surname as printed on the feed */
  goals: { name: string; goals: number }[];
};

/* ── the committed snapshot ─────────────────────────────────────────── */

export type SnapshotFixture = {
  date: string;
  venue: "H" | "A";
  opponent: string;
  competition: string;
  goals_for?: number;
  goals_against?: number;
  ht_for?: number;
  ht_against?: number;
  attendance?: number | null;
  scorers?: string[];
  kickoff?: string;
};

export type SnapshotTableRow = {
  position: number;
  team: string;
  home: { p: number; w: number; d: number; l: number };
  away: { p: number; w: number; d: number; l: number };
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export type Snapshot = {
  club: { name: string; slug: string; league: string; division: string; season: string; ground?: string; founded?: number; source?: string };
  fixtures: SnapshotFixture[];
  table: SnapshotTableRow[];
  table_as_of: string;
  appearances: { name: string; appearances: number }[];
};

/** "3pm" -> "15:00", "7.45pm" -> "19:45", "11.30am" -> "11:30"; "15:00" passes through. */
export function normaliseKickoff(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (/^\d{1,2}:\d{2}$/.test(s)) return s.padStart(5, "0");
  const m = s.match(/^(\d{1,2})(?:[.:](\d{2}))?\s*(am|pm)$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ?? "00";
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${min}`;
}

/**
 * "Mcnally (2, 1 pen)" -> { name: "Mcnally", goals: 2 }; "Gavin (2)" -> 2;
 * "Joaquim" -> 1; "Smith (pen)" -> 1. Own goals ("og") are not the club's.
 */
export function parseScorer(entry: string): { name: string; goals: number } | null {
  const s = entry.trim();
  if (!s) return null;
  if (/\bog\b/i.test(s)) return null;
  const m = s.match(/^(.+?)\s*(?:\(([^)]*)\))?$/);
  if (!m) return null;
  const name = m[1].trim();
  const inside = m[2] ?? "";
  const count = inside.match(/^\s*(\d+)/);
  return { name, goals: count ? Number(count[1]) : 1 };
}

/** Sum goals by surname across a set of results. */
export function goalsByScorer(results: readonly { scorers: string[] }[]): { name: string; goals: number }[] {
  const tally = new Map<string, number>();
  for (const r of results) {
    for (const entry of r.scorers) {
      const parsed = parseScorer(entry);
      if (!parsed) continue;
      tally.set(parsed.name, (tally.get(parsed.name) ?? 0) + parsed.goals);
    }
  }
  return [...tally.entries()].map(([name, goals]) => ({ name, goals })).sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

/** A league game is anything that is not a cup, vase, trophy or shield. */
export function isLeague(competition: string): boolean {
  return !/\b(cup|vase|trophy|shield|plate|charity)\b/i.test(competition);
}

/** Points after each league match, in date order. Position is only known for the last point. */
export function progressFrom(results: readonly SeasonResult[], latestPosition: number | null): SeasonProgress[] {
  const league = results.filter((r) => isLeague(r.competition)).sort((a, b) => a.match_date.localeCompare(b.match_date));
  let pts = 0;
  return league.map((r, i) => {
    pts += r.goals_for > r.goals_against ? 3 : r.goals_for === r.goals_against ? 1 : 0;
    return { match_no: i + 1, match_date: r.match_date, points: pts, position: i === league.length - 1 ? latestPosition : null };
  });
}

export function fromSnapshot(snap: Snapshot): SeasonData {
  const results: SeasonResult[] = [];
  const fixtures: SeasonFixture[] = [];
  for (const f of snap.fixtures) {
    if (typeof f.goals_for === "number" && typeof f.goals_against === "number") {
      results.push({
        match_date: f.date,
        competition: f.competition,
        opponent: f.opponent,
        venue: f.venue,
        goals_for: f.goals_for,
        goals_against: f.goals_against,
        ht_for: f.ht_for ?? null,
        ht_against: f.ht_against ?? null,
        attendance: f.attendance ?? null,
        scorers: f.scorers ?? [],
        source: "snapshot",
      });
    } else {
      fixtures.push({
        match_date: f.date,
        kickoff: normaliseKickoff(f.kickoff),
        opponent: f.opponent,
        venue: f.venue,
        competition: f.competition,
      });
    }
  }
  const team = snap.club.name;
  const standings: SeasonStanding[] = snap.table.map((row) => ({
    as_of: snap.table_as_of,
    position: row.position,
    team: row.team,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    gf: row.gf,
    ga: row.ga,
    gd: row.gd,
    points: row.points,
    home: row.home,
    away: row.away,
    is_us: row.team === team,
  }));
  const us = standings.find((s) => s.is_us);
  return {
    team,
    asOf: snap.table_as_of,
    results: results.sort((a, b) => a.match_date.localeCompare(b.match_date)),
    fixtures: fixtures.sort((a, b) => a.match_date.localeCompare(b.match_date)),
    standings,
    progress: progressFrom(results, us?.position ?? null),
    appearances: snap.appearances.map((a) => ({ name: a.name, apps: a.appearances })),
    goals: goalsByScorer(results),
  };
}

/* ── name matching ──────────────────────────────────────────────────── */

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z\s-]/g, "").trim();

/**
 * Match a feed name ("Mcnally", or "Jordan Mcnally") to exactly one player.
 * Returns null when nobody or more than one player fits: two Kimbers means
 * "Kimber" belongs to neither until the feed says which.
 */
export function matchPlayer<T extends { name: string }>(feedName: string, players: readonly T[]): T | null {
  const target = fold(feedName);
  const exact = players.filter((p) => fold(p.name) === target);
  if (exact.length === 1) return exact[0];
  const bySurname = players.filter((p) => {
    const parts = fold(p.name).split(/\s+/);
    return parts[parts.length - 1] === target || parts.join(" ").endsWith(` ${target}`);
  });
  return bySurname.length === 1 ? bySurname[0] : null;
}

/** The club's own row in a standings list. */
export function ourStanding<T extends { is_us: boolean }>(standings: readonly T[]): T | null {
  return standings.find((s) => s.is_us) ?? null;
}

/** W/D/L letters for the last `n` results, oldest first. */
export function formLetters(results: readonly SeasonResult[], n = 6): ("W" | "D" | "L")[] {
  return [...results]
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
    .slice(-n)
    .map((r) => (r.goals_for > r.goals_against ? "W" : r.goals_for === r.goals_against ? "D" : "L"));
}
