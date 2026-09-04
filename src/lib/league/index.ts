/**
 * The season feed boundary. `loadSeason` picks the provider (the API when a
 * key is present, the committed snapshot otherwise); `refreshSeason` writes
 * what it got into the club's tables. No Next.js imports here: the seed and
 * refresh scripts run this in plain node with a supabase-js client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Club, Database, ExternalStats, Player } from "@/lib/types";

import { fwpConfigFromEnv, loadFromFwp } from "./fwp";
import { fromSnapshot, matchPlayer, type SeasonData, type Snapshot } from "./normalise";

export type { SeasonData, SeasonFixture, SeasonProgress, SeasonResult, SeasonStanding } from "./normalise";
export { formLetters, goalsByScorer, isLeague, matchPlayer, normaliseKickoff, ourStanding, parseScorer, progressFrom } from "./normalise";

export type SeasonSource = "fwp" | "snapshot";

export async function loadSeason(
  club: Pick<Club, "name" | "slug">,
  opts: { snapshot?: Snapshot; today: string; env?: NodeJS.ProcessEnv },
): Promise<{ source: SeasonSource; data: SeasonData }> {
  const cfg = fwpConfigFromEnv(opts.env);
  if (cfg) {
    try {
      const data = await loadFromFwp(cfg, club.name, opts.today);
      if (data.results.length + data.fixtures.length > 0) return { source: "fwp", data };
    } catch (e) {
      // the snapshot is the floor, never an empty season
      console.warn(`fwp unavailable, using snapshot: ${(e as Error).message}`);
    }
  }
  if (!opts.snapshot) throw new Error(`no season feed for ${club.slug ?? club.name}: no FWP key and no snapshot`);
  return { source: "snapshot", data: fromSnapshot(opts.snapshot) };
}

export type RefreshReport = {
  source: SeasonSource;
  results: number;
  fixturesAdded: number;
  standings: number;
  progress: number;
  playersUpdated: string[];
  unmatched: string[];
};

type Db = SupabaseClient<Database>;

/** Write a season into the club's tables. Idempotent on the natural keys. */
export async function refreshSeason(db: Db, club: Pick<Club, "id" | "name" | "slug">, season: { source: SeasonSource; data: SeasonData }, today: string): Promise<RefreshReport> {
  const { data } = season;
  const cid = club.id;

  if (data.results.length) {
    const { error } = await db.from("results").upsert(
      data.results.map((r) => ({ ...r, club_id: cid })),
      { onConflict: "club_id,match_date,opponent" },
    );
    if (error) throw error;
  }

  if (data.standings.length) {
    const { error } = await db.from("league_standings").upsert(
      data.standings.map((s) => ({ ...s, as_of: today, club_id: cid })),
      { onConflict: "club_id,as_of,team" },
    );
    if (error) throw error;
  }

  if (data.progress.length) {
    const { error } = await db.from("league_progress").upsert(
      data.progress.map((p) => ({ ...p, club_id: cid })),
      { onConflict: "club_id,match_no" },
    );
    if (error) throw error;
  }

  // fixtures have no unique key of their own: add the ones we do not have
  let fixturesAdded = 0;
  if (data.fixtures.length) {
    const { data: existing, error } = await db.from("fixtures").select("match_date, opponent").eq("club_id", cid);
    if (error) throw error;
    const have = new Set((existing ?? []).map((f) => `${f.match_date}|${f.opponent}`));
    const missing = data.fixtures.filter((f) => !have.has(`${f.match_date}|${f.opponent}`));
    if (missing.length) {
      const { error: iErr } = await db.from("fixtures").insert(missing.map((f) => ({ ...f, club_id: cid })));
      if (iErr) throw iErr;
      fixturesAdded = missing.length;
    }
  }

  // season numbers onto players, by name; ambiguous names stay untouched
  const { data: players, error: pErr } = await db.from("players").select("*").eq("club_id", cid);
  if (pErr) throw pErr;
  const list = (players ?? []) as Player[];
  const perPlayer = new Map<string, ExternalStats>();
  const unmatched: string[] = [];
  for (const a of data.appearances) {
    const p = matchPlayer(a.name, list);
    if (!p) {
      unmatched.push(a.name);
      continue;
    }
    perPlayer.set(p.id, { ...(perPlayer.get(p.id) ?? {}), apps: a.apps });
  }
  for (const g of data.goals) {
    const p = matchPlayer(g.name, list);
    if (!p) {
      unmatched.push(g.name);
      continue;
    }
    perPlayer.set(p.id, { ...(perPlayer.get(p.id) ?? {}), goals: g.goals });
  }
  const playersUpdated: string[] = [];
  for (const [id, stats] of perPlayer) {
    const current = list.find((p) => p.id === id)!;
    const merged: ExternalStats = { ...(current.external_stats ?? {}), ...stats, as_of: today, source: season.source };
    const { error } = await db.from("players").update({ external_stats: merged }).eq("id", id);
    if (error) throw error;
    playersUpdated.push(current.name);
  }

  return {
    source: season.source,
    results: data.results.length,
    fixturesAdded,
    standings: data.standings.length,
    progress: data.progress.length,
    playersUpdated,
    unmatched: [...new Set(unmatched)],
  };
}
