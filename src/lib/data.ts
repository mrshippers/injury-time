/**
 * The single data-access boundary between Supabase and the UI.
 * Every route reads (and writes) through here - one owner, one
 * normaliser, so the engine is fed identical shapes everywhere.
 * Server-side only: import from Server Components or actions.
 */
import {
  acuteLoad,
  acwr,
  flagFor,
  weekOnWeekChange,
  type AcwrResult,
  type LoadEntry,
  type LoadFlag,
  type WeekOnWeekResult,
} from "@/lib/load-engine";
import { readinessFor, type Readiness } from "@/lib/readiness";
import { fromExternalStats, sumMatchRows, type MatchRow, type SeasonStats } from "@/lib/stats";
import { cache } from "react";

import { formLetters, ourStanding } from "@/lib/league/normalise";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";
import type {
  AvailabilityStatus,
  BodyRegion,
  Clip,
  Club,
  CurrentAvailability,
  Fixture,
  Injury,
  MatchCall,
  Notification,
  Player,
  ProgressPoint,
  Result,
  SavedLineup,
  SessionKind,
  Severity,
  Side,
  Standing,
} from "@/lib/types";

/** ISO date (yyyy-mm-dd) for "today" in Europe/London. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
  }).format(new Date());
}

function daysAgoISO(days: number, from = todayISO()): string {
  const d = new Date(`${from}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from `a` to `b`; negative when `b` is earlier. */
export function daysBetweenISO(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

/**
 * The club this request operates on: the signed-in member's club, or for a
 * guest the public club the `it.club` cookie names (Belstone by default).
 * One resolution per request, however many readers ask.
 */
export const getActiveClub = cache(async (): Promise<Club> => (await getViewer()).club);

/** Per-player load history over the trailing `days`, oldest first. */
async function loadEntriesByPlayer(
  clubId: string,
  days: number,
): Promise<Map<string, LoadEntry[]>> {
  const supabase = await createClient();
  const since = daysAgoISO(days);
  const { data, error } = await supabase
    .from("session_loads")
    .select("player_id, load, sessions!inner(session_date)")
    .eq("club_id", clubId)
    .gte("sessions.session_date", since)
    .order("session_date", { referencedTable: "sessions", ascending: true });
  if (error) throw error;
  const map = new Map<string, LoadEntry[]>();
  for (const row of data ?? []) {
    const session = row.sessions as unknown as { session_date: string };
    const list = map.get(row.player_id) ?? [];
    list.push({ date: session.session_date, load: row.load });
    map.set(row.player_id, list);
  }
  return map;
}

/**
 * Season line per player from logged MATCH sessions only. This is the
 * `logged_matches` provider of `@/lib/stats`: the manager's own match log is
 * the source of truth, because nothing upstream publishes Step 5 stats.
 */
async function seasonStatsByPlayer(clubId: string): Promise<Map<string, SeasonStats>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_loads")
    .select("player_id, minutes, goals, assists, yellow, red, sessions!inner(kind)")
    .eq("club_id", clubId)
    .eq("sessions.kind", "match");
  if (error) throw error;
  const rows = new Map<string, MatchRow[]>();
  for (const row of data ?? []) {
    const list = rows.get(row.player_id) ?? [];
    list.push({
      minutes: row.minutes,
      goals: row.goals,
      assists: row.assists,
      yellow: row.yellow,
      red: row.red,
    });
    rows.set(row.player_id, list);
  }
  const out = new Map<string, SeasonStats>();
  for (const [playerId, list] of rows) out.set(playerId, sumMatchRows(list));
  return out;
}

/** Fixtures on or after today, soonest first. */
async function upcomingFixtures(clubId: string, limit: number): Promise<Fixture[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select("*")
    .eq("club_id", clubId)
    .gte("match_date", todayISO())
    .order("match_date", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Fixture[];
}

/** The most recent logged session and how many players were on it. */
async function lastSession(
  clubId: string,
): Promise<{ date: string; kind: SessionKind; opponent: string | null; logged: number } | null> {
  const supabase = await createClient();
  const { data: session } = await supabase
    .from("sessions")
    .select("id, session_date, kind, opponent")
    .eq("club_id", clubId)
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!session) return null;
  const { count } = await supabase
    .from("session_loads")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id);
  return {
    date: session.session_date,
    kind: session.kind as SessionKind,
    opponent: session.opponent,
    logged: count ?? 0,
  };
}

export type SquadRow = {
  player: Player;
  availability: CurrentAvailability | null;
  /** acute (7-day) load, AU */
  weekLoad: number;
  acwr: AcwrResult;
  weekChange: WeekOnWeekResult;
  flag: LoadFlag;
  readiness: Readiness;
  stats: SeasonStats;
};

export type SquadBoard = {
  club: Club;
  asOf: string;
  rows: SquadRow[];
};

async function squadRows(club: Club, asOf: string): Promise<SquadRow[]> {
  const supabase = await createClient();
  const [{ data: players, error: pErr }, { data: avail, error: aErr }, loads, stats] =
    await Promise.all([
      supabase
        .from("players")
        .select("*")
        .eq("club_id", club.id)
        .is("retired_on", null)
        .order("squad_number", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true }),
      supabase.from("current_availability").select("*").eq("club_id", club.id),
      loadEntriesByPlayer(club.id, 42),
      seasonStatsByPlayer(club.id),
    ]);
  if (pErr) throw pErr;
  if (aErr) throw aErr;
  const availByPlayer = new Map(
    (avail ?? []).map((a) => [a.player_id, a as CurrentAvailability]),
  );
  return (players ?? []).map((p) => {
    const entries = loads.get(p.id) ?? [];
    const ratio = acwr(entries, asOf);
    const flag = flagFor(entries, asOf);
    return {
      player: p as Player,
      availability: availByPlayer.get(p.id) ?? null,
      weekLoad: acuteLoad(entries, asOf),
      acwr: ratio,
      weekChange: weekOnWeekChange(entries, asOf),
      flag,
      readiness: readinessFor(ratio, flag),
      stats: stats.get(p.id) ?? fromExternalStats((p as Player).external_stats),
    };
  });
}

export async function getSquadBoard(): Promise<SquadBoard> {
  const club = await getActiveClub();
  const asOf = todayISO();
  return { club, asOf, rows: await squadRows(club, asOf) };
}

/* ── dashboard ───────────────────────────────────────────── */

export type Dashboard = {
  club: Club;
  asOf: string;
  counts: Record<AvailabilityStatus, number>;
  /** Players the gaffer should look at before picking a side, worst first. */
  watchList: SquadRow[];
  /** Injured or doubtful players with a return date inside the next 7 days. */
  backSoon: SquadRow[];
  fixtures: Fixture[];
  lastSession: Awaited<ReturnType<typeof lastSession>>;
  topScorers: SquadRow[];
  topAssists: SquadRow[];
  /** Fit players by position, so the tile can say "can field an XI" or not. */
  fitByPosition: Record<Player["position"], number>;
  squadSize: number;
};

export async function getDashboard(): Promise<Dashboard> {
  const club = await getActiveClub();
  const asOf = todayISO();
  const [rows, fixtures, last] = await Promise.all([
    squadRows(club, asOf),
    upcomingFixtures(club.id, 3),
    lastSession(club.id),
  ]);

  const counts: Record<AvailabilityStatus, number> = { fit: 0, doubt: 0, injured: 0, suspended: 0 };
  const fitByPosition: Record<Player["position"], number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
  for (const row of rows) {
    const status = row.availability?.status ?? "fit";
    counts[status] += 1;
    if (status === "fit") fitByPosition[row.player.position] += 1;
  }

  const rank: Record<Readiness["key"], number> = { red: 0, pushing: 1, undercooked: 2, unknown: 9, steady: 9 };
  const watchList = rows
    .filter((r) => {
      const status = r.availability?.status ?? "fit";
      return (status === "fit" || status === "doubt") && rank[r.readiness.key] < 9;
    })
    .sort((a, b) => rank[a.readiness.key] - rank[b.readiness.key] || (b.acwr.kind === "ratio" ? b.acwr.value : 0) - (a.acwr.kind === "ratio" ? a.acwr.value : 0))
    .slice(0, 5);

  const backSoon = rows
    .filter((r) => {
      const a = r.availability;
      if (!a || !a.return_date) return false;
      if (a.status !== "injured" && a.status !== "doubt" && a.status !== "suspended") return false;
      const d = daysBetweenISO(asOf, a.return_date);
      return d >= 0 && d <= 7;
    })
    .sort((a, b) => a.availability!.return_date!.localeCompare(b.availability!.return_date!));

  const topScorers = [...rows].filter((r) => r.stats.goals > 0).sort((a, b) => b.stats.goals - a.stats.goals || b.stats.assists - a.stats.assists).slice(0, 3);
  const topAssists = [...rows].filter((r) => r.stats.assists > 0).sort((a, b) => b.stats.assists - a.stats.assists || b.stats.goals - a.stats.goals).slice(0, 3);

  return {
    club,
    asOf,
    counts,
    watchList,
    backSoon,
    fixtures,
    lastSession: last,
    topScorers,
    topAssists,
    fitByPosition,
    squadSize: rows.length,
  };
}

/* ── lineup ──────────────────────────────────────────────── */

export type LineupData = {
  club: Club;
  asOf: string;
  nextFixture: Fixture | null;
  rows: SquadRow[];
};

export async function getLineupData(): Promise<LineupData> {
  const club = await getActiveClub();
  const asOf = todayISO();
  const [rows, fixtures] = await Promise.all([squadRows(club, asOf), upcomingFixtures(club.id, 1)]);
  return { club, asOf, nextFixture: fixtures[0] ?? null, rows };
}

/* ── player profile ──────────────────────────────────────── */

export type PlayerProfile = {
  club: Club;
  asOf: string;
  player: Player;
  availability: CurrentAvailability | null;
  injuries: Injury[];
  /** oldest first, trailing 42 days */
  loads: LoadEntry[];
  availabilityHistory: {
    status: AvailabilityStatus;
    noted_on: string;
    return_date: string | null;
    created_at: string;
  }[];
  weekLoad: number;
  acwr: AcwrResult;
  weekChange: WeekOnWeekResult;
  flag: LoadFlag;
  readiness: Readiness;
  stats: SeasonStats;
};

export async function getPlayerProfile(
  playerId: string,
): Promise<PlayerProfile | null> {
  const club = await getActiveClub();
  const supabase = await createClient();
  const asOf = todayISO();
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .eq("club_id", club.id)
    .maybeSingle();
  if (!player) return null;
  const [availRes, injuriesRes, historyRes, loads, stats] = await Promise.all([
    supabase
      .from("current_availability")
      .select("*")
      .eq("player_id", playerId)
      .maybeSingle(),
    supabase
      .from("injuries")
      .select("*")
      .eq("player_id", playerId)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("availability_events")
      .select("status, noted_on, return_date, created_at")
      .eq("player_id", playerId)
      .order("created_at", { ascending: false })
      .limit(20),
    loadEntriesByPlayer(club.id, 42),
    seasonStatsByPlayer(club.id),
  ]);
  const entries = loads.get(playerId) ?? [];
  const ratio = acwr(entries, asOf);
  const flag = flagFor(entries, asOf);
  return {
    club,
    asOf,
    player: player as Player,
    availability: (availRes.data as CurrentAvailability) ?? null,
    injuries: (injuriesRes.data ?? []) as Injury[],
    availabilityHistory: historyRes.data ?? [],
    loads: entries,
    weekLoad: acuteLoad(entries, asOf),
    acwr: ratio,
    weekChange: weekOnWeekChange(entries, asOf),
    flag,
    readiness: readinessFor(ratio, flag),
    stats: stats.get(playerId) ?? fromExternalStats((player as Player).external_stats),
  };
}

/** Roster for the logger: players + current availability only. */
export async function getRoster(): Promise<{
  club: Club;
  players: (Player & { status: AvailabilityStatus | null })[];
}> {
  const club = await getActiveClub();
  const supabase = await createClient();
  const [{ data: players, error }, { data: avail }] = await Promise.all([
    supabase
      .from("players")
      .select("*")
      .eq("club_id", club.id)
      .is("retired_on", null)
      .order("squad_number", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true }),
    supabase.from("current_availability").select("*").eq("club_id", club.id),
  ]);
  if (error) throw error;
  const statusBy = new Map((avail ?? []).map((a) => [a.player_id, a.status]));
  return {
    club,
    players: (players ?? []).map((p) => ({
      ...(p as Player),
      status: (statusBy.get(p.id) as AvailabilityStatus) ?? null,
    })),
  };
}

/* ── writes ──────────────────────────────────────────────── */

export type LoadEntryInput = {
  playerId: string;
  rpe: number;
  minutes: number;
  goals?: number;
  assists?: number;
  yellow?: number;
  red?: number;
};

/** Create a session and its per-player loads in one go. */
export async function logSession(input: {
  sessionDate: string;
  kind: SessionKind;
  opponent?: string;
  entries: LoadEntryInput[];
}): Promise<{ sessionId: string }> {
  const club = await getActiveClub();
  const supabase = await createClient();
  const { data: session, error: sErr } = await supabase
    .from("sessions")
    .insert({
      club_id: club.id,
      session_date: input.sessionDate,
      kind: input.kind,
      opponent: input.opponent ?? null,
    })
    .select("id")
    .single();
  if (sErr) throw sErr;
  if (input.entries.length > 0) {
    const isMatch = input.kind === "match";
    const { error: lErr } = await supabase.from("session_loads").insert(
      input.entries.map((e) => ({
        club_id: club.id,
        session_id: session.id,
        player_id: e.playerId,
        rpe: e.rpe,
        minutes: e.minutes,
        // stats only mean something on a match; a training row stays at 0
        goals: isMatch ? (e.goals ?? 0) : 0,
        assists: isMatch ? (e.assists ?? 0) : 0,
        yellow: isMatch ? (e.yellow ?? 0) : 0,
        red: isMatch ? (e.red ?? 0) : 0,
      })),
    );
    if (lErr) throw lErr;
  }
  return { sessionId: session.id };
}

/**
 * Set a player's availability. `injured` requires a body region and
 * creates the linked injury record (the body map's data source).
 */
export async function setAvailability(input: {
  playerId: string;
  status: AvailabilityStatus;
  returnDate?: string;
  injury?: {
    bodyRegion: BodyRegion;
    side: Side;
    severity: Severity;
  };
}): Promise<void> {
  const club = await getActiveClub();
  const supabase = await createClient();
  let injuryId: string | null = null;
  if (input.status === "injured") {
    if (!input.injury) throw new Error("injured status requires an injury");
    const { data: injury, error } = await supabase
      .from("injuries")
      .insert({
        club_id: club.id,
        player_id: input.playerId,
        body_region: input.injury.bodyRegion,
        side: input.injury.side,
        severity: input.injury.severity,
        occurred_on: todayISO(),
        expected_return: input.returnDate ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    injuryId = injury.id;
  } else {
    // returning to fit resolves any open injuries
    if (input.status === "fit") {
      await supabase
        .from("injuries")
        .update({ resolved_on: todayISO() })
        .eq("player_id", input.playerId)
        .is("resolved_on", null);
    }
  }
  const { error } = await supabase.from("availability_events").insert({
    club_id: club.id,
    player_id: input.playerId,
    status: input.status,
    return_date: input.returnDate ?? null,
    injury_id: injuryId,
  });
  if (error) throw error;
}

/* ── the season, the side, the squad talking back, the film ─────────── */

export type Season = {
  results: Result[];
  /** the latest table snapshot, in position order */
  standings: Standing[];
  standingsAsOf: string | null;
  /** our own row of that table */
  us: Standing | null;
  progress: ProgressPoint[];
  /** last six results, oldest first */
  form: ("W" | "D" | "L")[];
  /** home crowds, oldest first */
  attendance: { match_date: string; opponent: string; crowd: number }[];
};

export const getSeason = cache(async (clubId: string): Promise<Season> => {
  const supabase = await createClient();
  const [resultsRes, latestRes, progressRes] = await Promise.all([
    supabase.from("results").select("*").eq("club_id", clubId).order("match_date", { ascending: true }),
    supabase.from("league_standings").select("as_of").eq("club_id", clubId).order("as_of", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("league_progress").select("*").eq("club_id", clubId).order("match_no", { ascending: true }),
  ]);
  if (resultsRes.error) throw resultsRes.error;
  if (progressRes.error) throw progressRes.error;
  const standingsAsOf = latestRes.data?.as_of ?? null;
  let standings: Standing[] = [];
  if (standingsAsOf) {
    const { data, error } = await supabase
      .from("league_standings")
      .select("*")
      .eq("club_id", clubId)
      .eq("as_of", standingsAsOf)
      .order("position", { ascending: true });
    if (error) throw error;
    standings = (data ?? []) as Standing[];
  }
  const results = (resultsRes.data ?? []) as Result[];
  return {
    results,
    standings,
    standingsAsOf,
    us: ourStanding(standings),
    progress: (progressRes.data ?? []) as ProgressPoint[],
    form: formLetters(results),
    attendance: results
      .filter((r) => r.venue === "H" && r.attendance !== null)
      .map((r) => ({ match_date: r.match_date, opponent: r.opponent, crowd: r.attendance as number })),
  };
});

export async function getSavedLineup(clubId: string, fixtureId: string): Promise<SavedLineup | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lineups").select("*").eq("club_id", clubId).eq("fixture_id", fixtureId).maybeSingle();
  if (error) throw error;
  return (data as SavedLineup) ?? null;
}

export async function getMatchCalls(clubId: string, fixtureId: string): Promise<MatchCall[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("match_calls").select("*").eq("club_id", clubId).eq("fixture_id", fixtureId);
  if (error) throw error;
  return (data ?? []) as MatchCall[];
}

export async function getNotifications(clubId: string, limit = 20): Promise<Notification[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function getClips(clubId: string): Promise<Clip[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clips").select("*").eq("club_id", clubId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Clip[];
}
