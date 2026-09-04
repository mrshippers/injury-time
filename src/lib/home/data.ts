/**
 * What the homepage reads beyond the squad board: the season from the league
 * feed, the calls for the next match, the crowd. Server-side only.
 */
import { createClient } from "@/lib/supabase/server";
import type { CallStatus, Fixture, Player, ProgressPoint, Result, Standing } from "@/lib/types";

export type HomeSeason = {
  results: Result[];
  standings: Standing[];
  standingsAsOf: string | null;
  progress: ProgressPoint[];
  fixtures: Fixture[];
  calls: Record<CallStatus, number> & { total: number };
  /** goals from the league feed, best first */
  feedScorers: { player: Player; goals: number; apps: number }[];
  feedAsOf: string | null;
};

export async function getHomeSeason(clubId: string, asOf: string): Promise<HomeSeason> {
  const supabase = await createClient();
  const [{ data: results }, { data: latest }, { data: progress }, { data: fixtures }, { data: players }] = await Promise.all([
    supabase.from("results").select("*").eq("club_id", clubId).order("match_date", { ascending: true }),
    supabase.from("league_standings").select("as_of").eq("club_id", clubId).order("as_of", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("league_progress").select("*").eq("club_id", clubId).order("match_no", { ascending: true }),
    supabase.from("fixtures").select("*").eq("club_id", clubId).gte("match_date", asOf).order("match_date", { ascending: true }),
    supabase.from("players").select("*").eq("club_id", clubId).is("retired_on", null),
  ]);

  let standings: Standing[] = [];
  const standingsAsOf = latest?.as_of ?? null;
  if (standingsAsOf) {
    const { data } = await supabase
      .from("league_standings")
      .select("*")
      .eq("club_id", clubId)
      .eq("as_of", standingsAsOf)
      .order("position", { ascending: true });
    standings = (data ?? []) as Standing[];
  }

  const next = (fixtures ?? [])[0] as Fixture | undefined;
  const calls: HomeSeason["calls"] = { in: 0, out: 0, unsure: 0, total: 0 };
  if (next) {
    const { data } = await supabase.from("match_calls").select("status").eq("fixture_id", next.id);
    for (const c of data ?? []) {
      const s = c.status as CallStatus;
      calls[s] += 1;
      calls.total += 1;
    }
  }

  const feedScorers = ((players ?? []) as Player[])
    .filter((p) => (p.external_stats?.goals ?? 0) > 0)
    .map((p) => ({ player: p, goals: p.external_stats?.goals ?? 0, apps: p.external_stats?.apps ?? 0 }))
    .sort((a, b) => b.goals - a.goals || b.apps - a.apps)
    .slice(0, 4);
  const feedAsOf = ((players ?? []) as Player[]).find((p) => p.external_stats?.as_of)?.external_stats?.as_of ?? null;

  return {
    results: (results ?? []) as Result[],
    standings,
    standingsAsOf,
    progress: (progress ?? []) as ProgressPoint[],
    fixtures: (fixtures ?? []) as Fixture[],
    calls,
    feedScorers,
    feedAsOf,
  };
}
