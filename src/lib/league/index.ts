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
import { reconcileFixtures, type DiaryRow } from "./reconcile";

export type { SeasonData, SeasonFixture, SeasonProgress, SeasonResult, SeasonStanding } from "./normalise";
export { divisionLine, formLetters, goalsByScorer, isLeague, matchPlayer, normaliseKickoff, ourStanding, parseScorer, progressFrom } from "./normalise";

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

export type DriftResult = { match_date: string; opponent: string; venue: "H" | "A"; competition: string; goals_for: number; goals_against: number };

export type RefreshReport = {
  source: SeasonSource;
  results: number;
  fixturesAdded: number;
  /** moved to a new date, or dropped by the feed */
  fixturesChanged: number;
  standings: number;
  progress: number;
  playersUpdated: string[];
  unmatched: string[];
  /** what actually moved since the last run, not what was rewritten: this is the drift */
  resultsChanged: string[];
  /** the same rows, structured, so a notice can say them in words */
  resultsDetail: DriftResult[];
  playersChanged: string[];
  /** a table dated this as_of was not there before */
  tableNew: boolean;
};

/** "22 Sep v Maidenhead Town 5-1" */
const resultLabel = (r: { match_date: string; opponent: string; goals_for: number; goals_against: number }) =>
  `${r.match_date} v ${r.opponent} ${r.goals_for}-${r.goals_against}`;

type Db = SupabaseClient<Database>;

/** Write a season into the club's tables. Idempotent on the natural keys. */
export async function refreshSeason(db: Db, club: Pick<Club, "id" | "name" | "slug">, season: { source: SeasonSource; data: SeasonData }, today: string): Promise<RefreshReport> {
  const { data } = season;
  const cid = club.id;

  // read what is there first, so the report can say what changed rather than what was rewritten
  const [beforeRes, tableRes] = await Promise.all([
    db.from("results").select("match_date, opponent, goals_for, goals_against, scorers").eq("club_id", cid),
    db.from("league_standings").select("id").eq("club_id", cid).eq("as_of", data.asOf || today).limit(1),
  ]);
  if (beforeRes.error) throw beforeRes.error;
  if (tableRes.error) throw tableRes.error;
  const before = new Map((beforeRes.data ?? []).map((r) => [`${r.match_date}|${r.opponent}`, `${r.goals_for}-${r.goals_against}|${(r.scorers ?? []).join(",")}`]));
  const changedRows = data.results.filter((r) => before.get(`${r.match_date}|${r.opponent}`) !== `${r.goals_for}-${r.goals_against}|${r.scorers.join(",")}`);
  const resultsChanged = changedRows.map(resultLabel);
  const resultsDetail: DriftResult[] = changedRows.map((r) => ({ match_date: r.match_date, opponent: r.opponent, venue: r.venue as "H" | "A", competition: r.competition, goals_for: r.goals_for, goals_against: r.goals_against }));
  const tableNew = data.standings.length > 0 && (tableRes.data ?? []).length === 0;

  if (data.results.length) {
    const { error } = await db.from("results").upsert(
      data.results.map((r) => ({ ...r, club_id: cid })),
      { onConflict: "club_id,match_date,opponent" },
    );
    if (error) throw error;
  }

  if (data.standings.length) {
    const { error } = await db.from("league_standings").upsert(
      // dated by the table itself, not the run: a snapshot read today is still the 26 sep table
      data.standings.map((s) => ({ ...s, as_of: data.asOf || today, club_id: cid })),
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

  // the diary follows the feed: add new games, move a rescheduled one in place (its calls follow),
  // drop one the feed dropped, and never delete a row somebody has answered a call for or built a side on
  let fixturesAdded = 0;
  let fixturesChanged = 0;
  if (data.fixtures.length) {
    const { data: existing, error } = await db.from("fixtures").select("id, match_date, opponent, competition, venue, kickoff").eq("club_id", cid).gte("match_date", today);
    if (error) throw error;
    const ids = (existing ?? []).map((f) => f.id);
    const hasWork = new Set<string>();
    if (ids.length) {
      const [calls, sides] = await Promise.all([db.from("match_calls").select("fixture_id").in("fixture_id", ids), db.from("lineups").select("fixture_id").in("fixture_id", ids)]);
      if (calls.error) throw calls.error;
      if (sides.error) throw sides.error;
      for (const r of [...(calls.data ?? []), ...(sides.data ?? [])]) hasWork.add(r.fixture_id as string);
    }
    const plan = reconcileFixtures(
      (existing ?? []) as DiaryRow[],
      data.fixtures.map((f) => ({ match_date: f.match_date, opponent: f.opponent, competition: f.competition, venue: f.venue as "H" | "A", kickoff: f.kickoff ?? null })),
      today,
      hasWork,
    );
    for (const m of plan.move) {
      const { error: mErr } = await db.from("fixtures").update(m.patch).eq("id", m.id);
      if (mErr) throw mErr;
    }
    if (plan.remove.length) {
      const { error: dErr } = await db.from("fixtures").delete().in("id", plan.remove);
      if (dErr) throw dErr;
    }
    if (plan.insert.length) {
      const { error: iErr } = await db.from("fixtures").insert(plan.insert.map((f) => ({ ...f, club_id: cid })));
      if (iErr) throw iErr;
    }
    fixturesAdded = plan.insert.length;
    fixturesChanged = plan.move.length + plan.remove.length;
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
  const playersChanged: string[] = [];
  for (const [id, stats] of perPlayer) {
    const current = list.find((p) => p.id === id)!;
    const was = current.external_stats ?? {};
    if ((stats.apps !== undefined && stats.apps !== was.apps) || (stats.goals !== undefined && stats.goals !== was.goals)) playersChanged.push(current.name);
    const merged: ExternalStats = { ...(current.external_stats ?? {}), ...stats, as_of: data.asOf || today, source: season.source };
    const { error } = await db.from("players").update({ external_stats: merged }).eq("id", id);
    if (error) throw error;
    playersUpdated.push(current.name);
  }

  // say how fresh the copy is: a snapshot is as old as its table, a live feed is as old as this run
  {
    const stamp = season.source === "snapshot" && data.asOf ? `${data.asOf}T12:00:00Z` : new Date().toISOString();
    const { error } = await db.from("clubs").update({ season_synced_at: stamp }).eq("id", cid);
    if (error) throw error;
  }

  return {
    source: season.source,
    results: data.results.length,
    fixturesAdded,
    fixturesChanged,
    standings: data.standings.length,
    progress: data.progress.length,
    playersUpdated,
    unmatched: [...new Set(unmatched)],
    resultsChanged,
    resultsDetail,
    playersChanged,
    tableNew,
  };
}
