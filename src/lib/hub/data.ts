/**
 * Everything the player's hub reads, in one pass, under the viewer's own row
 * level security. Health tables are not touched: this page is the footballer.
 */
import { getSeason, todayISO } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { fromExternalStats, sumMatchRows, type SeasonStats } from "@/lib/stats";
import type { CallStatus, Club, Clip, Fixture, HubProfile, Player } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

import { goalGames, milestones, moments, scoringRun, strikeRate, type GoalGame, type LoggedMatch, type Milestone, type Moment, type NextUp } from "./hub";

export type Hub = {
  club: Club;
  player: Player;
  profile: HubProfile | null;
  stats: SeasonStats;
  /** where the numbers came from, and to when */
  statsLine: string;
  strike: string | null;
  goals: GoalGame[];
  /** the club's named goals this season, for the share */
  clubGoals: number;
  won: Milestone[];
  next: NextUp[];
  moments: Moment[];
  pinned: Moment | null;
  nextMatch: { fixture: Fixture; call: CallStatus | null } | null;
  canEdit: boolean;
  /** the viewer is this player (or a guest trying the demo on them): they can call in or out */
  canCall: boolean;
  readOnly: boolean;
  /** the player's own account is linked: the page is theirs */
  claimed: boolean;
  /** a real club's manager or coach can hand the page over with a link */
  canHandOver: boolean;
  /** a guest trying the demo: show how handing over works, without a button */
  demoHandOver: boolean;
};

const DAY = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
export const shortDate = (iso: string) => DAY.format(new Date(`${iso}T12:00:00Z`));

export async function getHub(playerId: string): Promise<Hub | null> {
  const viewer = await getViewer();
  const club = viewer.club;
  const supabase = await createClient();
  const today = todayISO();

  const { data: player } = await supabase.from("players").select("*").eq("id", playerId).eq("club_id", club.id).maybeSingle();
  if (!player) return null;

  const [profileRes, rosterRes, loggedRes, clipsRes, fixtureRes, season] = await Promise.all([
    supabase.from("player_profiles").select("*").eq("player_id", playerId).maybeSingle(),
    supabase.from("players").select("id, name").eq("club_id", club.id),
    supabase
      .from("session_loads")
      .select("minutes, goals, assists, yellow, red, sessions!inner(kind, session_date, opponent)")
      .eq("player_id", playerId)
      .eq("sessions.kind", "match"),
    supabase.from("clips").select("*").eq("club_id", club.id),
    supabase.from("fixtures").select("*").eq("club_id", club.id).gte("match_date", today).order("match_date").limit(1).maybeSingle(),
    getSeason(club.id),
  ]);
  if (loggedRes.error) throw loggedRes.error;

  type Row = { minutes: number; goals: number; assists: number; yellow: number; red: number; sessions: { session_date: string; opponent: string | null } | { session_date: string; opponent: string | null }[] };
  const rows = (loggedRes.data ?? []) as unknown as Row[];
  const logged: LoggedMatch[] = rows
    .filter((r) => r.minutes > 0)
    .map((r) => {
      const s = Array.isArray(r.sessions) ? r.sessions[0] : r.sessions;
      return { date: s.session_date, opponent: s.opponent, minutes: r.minutes, goals: r.goals, assists: r.assists };
    });

  const p = player as Player;
  const stats = logged.length ? sumMatchRows(rows) : fromExternalStats(p.external_stats);
  const asOf = p.external_stats?.as_of;
  const statsLine =
    stats.source === "log"
      ? `from ${club.name}'s own match logs`
      : stats.source === "feed"
        ? `from the league's published figures${asOf ? `, to ${shortDate(asOf)}` : ""}`
        : "nothing logged yet";

  const goals = goalGames(p.id, rosterRes.data ?? [], season.results, logged);
  const matchDates = logged.length ? logged.map((m) => m.date) : season.results.map((r) => r.match_date);
  const run = scoringRun(goals, matchDates);
  const { won, next } = milestones(goals, stats, run, shortDate);
  const clips = (clipsRes.data ?? []) as Clip[];
  const all = moments(p.id, clips);
  const profile = (profileRes.data as HubProfile) ?? null;
  const pinned = profile?.pinned ? (all.find((m) => m.clipId === profile.pinned!.clip_id && m.t === profile.pinned!.t) ?? null) : null;

  let nextMatch: Hub["nextMatch"] = null;
  if (fixtureRes.data) {
    const f = fixtureRes.data as Fixture;
    const { data: call } = await supabase.from("match_calls").select("status").eq("fixture_id", f.id).eq("player_id", p.id).maybeSingle();
    nextMatch = { fixture: f, call: (call?.status as CallStatus) ?? null };
  }

  const own = viewer.playerId === p.id;
  const staff = viewer.role === "manager" || viewer.role === "coach";
  return {
    club,
    player: p,
    profile,
    stats,
    statsLine,
    strike: strikeRate(stats),
    goals,
    clubGoals: season.results.reduce((n, r) => n + r.goals_for, 0),
    won,
    next,
    moments: all,
    pinned,
    nextMatch,
    canEdit: !viewer.readOnly && (own || staff || viewer.guest),
    canCall: !viewer.readOnly && (own || viewer.guest),
    readOnly: viewer.readOnly,
    claimed: p.user_id !== null,
    canHandOver: !viewer.guest && staff && !club.is_demo,
    demoHandOver: viewer.guest && club.demo_writable,
  };
}
