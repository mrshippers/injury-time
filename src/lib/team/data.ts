/**
 * Reads for the team page. Server-side only. The page is the squad's phone:
 * who is the next match, who has called in, what the staff have said, and
 * how the crowd and the calls have run over the season.
 */
import { daysBetweenISO, todayISO } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import type { Fixture, MatchCall, Notification, Player, Result } from "@/lib/types";
import { getViewer, type Viewer } from "@/lib/viewer";

export type AttendancePoint = {
  /** ISO date of the match */
  date: string;
  opponent: string;
  venue: "H" | "A";
  /** players who called "in" for that fixture, null when the fixture predates calls */
  calledIn: number | null;
  /** the crowd, from the league feed, home matches usually */
  crowd: number | null;
};

export type TeamPage = {
  viewer: Viewer;
  asOf: string;
  next: Fixture | null;
  daysUntil: number | null;
  players: Player[];
  calls: MatchCall[];
  notices: Notification[];
  attendance: AttendancePoint[];
  /** the server clock at render, so "2 min ago" paints the same on both sides */
  now: number;
};

export async function getTeamPage(): Promise<TeamPage> {
  const viewer = await getViewer();
  const supabase = await createClient();
  const asOf = todayISO();
  const clubId = viewer.club.id;

  const [{ data: nextRows, error: fErr }, { data: players, error: pErr }, { data: notices, error: nErr }] = await Promise.all([
    supabase
      .from("fixtures")
      .select("*")
      .eq("club_id", clubId)
      .gte("match_date", asOf)
      .order("match_date", { ascending: true })
      .limit(1),
    supabase
      .from("players")
      .select("*")
      .eq("club_id", clubId)
      .is("retired_on", null)
      .order("squad_number", { ascending: true, nullsFirst: false }),
    supabase
      .from("notifications")
      .select("*")
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (fErr) throw fErr;
  if (pErr) throw pErr;
  if (nErr) throw nErr;

  const next = ((nextRows ?? [])[0] as Fixture | undefined) ?? null;
  let calls: MatchCall[] = [];
  if (next) {
    const { data, error } = await supabase.from("match_calls").select("*").eq("fixture_id", next.id);
    if (error) throw error;
    calls = (data ?? []) as MatchCall[];
  }

  return {
    viewer,
    asOf,
    next,
    daysUntil: next ? daysBetweenISO(asOf, next.match_date) : null,
    players: (players ?? []) as Player[],
    calls,
    notices: (notices ?? []) as Notification[],
    attendance: await attendanceHistory(clubId, asOf),
    now: Date.now(),
  };
}

/**
 * One point per played match this season. Crowd comes from the league feed
 * (`results`), the call count from `match_calls` on the fixture row with the
 * same date and opponent, where one exists.
 */
async function attendanceHistory(clubId: string, asOf: string): Promise<AttendancePoint[]> {
  const supabase = await createClient();
  const [{ data: results }, { data: pastFixtures }] = await Promise.all([
    supabase.from("results").select("*").eq("club_id", clubId).lt("match_date", asOf).order("match_date", { ascending: true }),
    supabase.from("fixtures").select("*").eq("club_id", clubId).lt("match_date", asOf).order("match_date", { ascending: true }),
  ]);
  const fixtures = (pastFixtures ?? []) as Fixture[];
  const fixtureIds = fixtures.map((f) => f.id);
  let inCounts = new Map<string, number>();
  if (fixtureIds.length > 0) {
    const { data: calls } = await supabase.from("match_calls").select("fixture_id, status").in("fixture_id", fixtureIds);
    inCounts = new Map();
    for (const c of (calls ?? []) as Pick<MatchCall, "fixture_id" | "status">[]) {
      if (c.status === "in") inCounts.set(c.fixture_id, (inCounts.get(c.fixture_id) ?? 0) + 1);
    }
  }
  const fixtureByKey = new Map(fixtures.map((f) => [`${f.match_date}|${f.opponent}`, f]));
  const points: AttendancePoint[] = [];
  const seen = new Set<string>();
  for (const r of (results ?? []) as Result[]) {
    const key = `${r.match_date}|${r.opponent}`;
    seen.add(key);
    const f = fixtureByKey.get(key);
    points.push({
      date: r.match_date,
      opponent: r.opponent,
      venue: r.venue,
      calledIn: f ? (inCounts.get(f.id) ?? 0) : null,
      crowd: r.attendance,
    });
  }
  // fixtures that were played but never made it to the results feed still count for calls
  for (const f of fixtures) {
    const key = `${f.match_date}|${f.opponent}`;
    if (seen.has(key)) continue;
    points.push({ date: f.match_date, opponent: f.opponent, venue: f.venue, calledIn: inCounts.get(f.id) ?? 0, crowd: null });
  }
  points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return points;
}
