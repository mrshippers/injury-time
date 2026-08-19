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
import { createClient } from "@/lib/supabase/server";
import type {
  AvailabilityStatus,
  BodyRegion,
  Club,
  CurrentAvailability,
  Injury,
  Player,
  Session,
  SessionKind,
  Severity,
  Side,
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

/**
 * The club this request operates on: the signed-in user's club if they
 * have a membership, otherwise the demo club (public read/write demo).
 */
export async function getActiveClub(): Promise<Club> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", auth.user.id)
      .limit(1)
      .maybeSingle();
    if (membership) {
      const { data: club, error } = await supabase
        .from("clubs")
        .select("*")
        .eq("id", membership.club_id)
        .single();
      if (error) throw error;
      return club as Club;
    }
  }
  const { data: demo, error } = await supabase
    .from("clubs")
    .select("*")
    .eq("is_demo", true)
    .limit(1)
    .single();
  if (error) throw error;
  return demo as Club;
}

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

export type SquadRow = {
  player: Player;
  availability: CurrentAvailability | null;
  /** acute (7-day) load, AU */
  weekLoad: number;
  acwr: AcwrResult;
  weekChange: WeekOnWeekResult;
  flag: LoadFlag;
};

export type SquadBoard = {
  club: Club;
  asOf: string;
  rows: SquadRow[];
};

export async function getSquadBoard(): Promise<SquadBoard> {
  const club = await getActiveClub();
  const supabase = await createClient();
  const asOf = todayISO();
  const [{ data: players, error: pErr }, { data: avail, error: aErr }, loads] =
    await Promise.all([
      supabase
        .from("players")
        .select("*")
        .eq("club_id", club.id)
        .order("squad_number", { ascending: true }),
      supabase.from("current_availability").select("*").eq("club_id", club.id),
      loadEntriesByPlayer(club.id, 42),
    ]);
  if (pErr) throw pErr;
  if (aErr) throw aErr;
  const availByPlayer = new Map(
    (avail ?? []).map((a) => [a.player_id, a as CurrentAvailability]),
  );
  const rows: SquadRow[] = (players ?? []).map((p) => {
    const entries = loads.get(p.id) ?? [];
    return {
      player: p as Player,
      availability: availByPlayer.get(p.id) ?? null,
      weekLoad: acuteLoad(entries, asOf),
      acwr: acwr(entries, asOf),
      weekChange: weekOnWeekChange(entries, asOf),
      flag: flagFor(entries, asOf),
    };
  });
  return { club, asOf, rows };
}

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
  const [availRes, injuriesRes, historyRes, loads] = await Promise.all([
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
  ]);
  const entries = loads.get(playerId) ?? [];
  return {
    club,
    asOf,
    player: player as Player,
    availability: (availRes.data as CurrentAvailability) ?? null,
    injuries: (injuriesRes.data ?? []) as Injury[],
    availabilityHistory: historyRes.data ?? [],
    loads: entries,
    weekLoad: acuteLoad(entries, asOf),
    acwr: acwr(entries, asOf),
    weekChange: weekOnWeekChange(entries, asOf),
    flag: flagFor(entries, asOf),
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
      .order("squad_number", { ascending: true }),
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

export type LoadEntryInput = { playerId: string; rpe: number; minutes: number };

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
    const { error: lErr } = await supabase.from("session_loads").insert(
      input.entries.map((e) => ({
        club_id: club.id,
        session_id: session.id,
        player_id: e.playerId,
        rpe: e.rpe,
        minutes: e.minutes,
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
