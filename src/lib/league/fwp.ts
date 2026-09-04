/**
 * Football Web Pages v2. Free for non-league clubs on request; a key arrives
 * by email and goes in FWP_API_KEY, the team id in FWP_TEAM_ID. Ten requests
 * a minute, so every call is cached for the life of the process and the
 * refresh makes at most five calls.
 *
 * The response shapes below are the documented field names; they are marked
 * unverified until the first real key runs through `scripts/refresh-season.ts`.
 * Anything the mapper cannot read is skipped, never invented.
 */
import { SEASON_FEED } from "@/lib/config";

import { goalsByScorer, isLeague, normaliseKickoff, type SeasonData, type SeasonFixture, type SeasonResult, type SeasonStanding } from "./normalise";

export type FwpConfig = { apiKey: string; teamId: string; fetchImpl?: typeof fetch };

export function fwpConfigFromEnv(env: NodeJS.ProcessEnv = process.env): FwpConfig | null {
  const apiKey = env[SEASON_FEED.keyEnv];
  const teamId = env[SEASON_FEED.teamEnv];
  if (!apiKey || !teamId) return null;
  return { apiKey, teamId };
}

const cache = new Map<string, { at: number; body: unknown }>();
const TTL_MS = 10 * 60 * 1000;

async function get(cfg: FwpConfig, endpoint: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(`${SEASON_FEED.baseUrl}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const key = url.toString();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.body;
  const doFetch = cfg.fetchImpl ?? fetch;
  const res = await doFetch(key, { headers: { [SEASON_FEED.keyHeader]: cfg.apiKey }, cache: "no-store" });
  if (!res.ok) throw new Error(`fwp ${endpoint} ${res.status}`);
  const body = (await res.json()) as unknown;
  cache.set(key, { at: Date.now(), body });
  return body;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown): number | null => (typeof v === "number" ? v : typeof v === "string" && /^-?\d+$/.test(v) ? Number(v) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Find the first array anywhere in a shallow response envelope. */
function firstArray(body: unknown, keys: string[]): unknown[] {
  const o = obj(body);
  for (const k of keys) {
    const v = o[k];
    if (Array.isArray(v)) return v;
    const inner = obj(v);
    for (const ik of keys) if (Array.isArray(inner[ik])) return inner[ik] as unknown[];
  }
  for (const v of Object.values(o)) if (Array.isArray(v)) return v;
  return [];
}

export function mapFixturesResults(body: unknown, teamName: string): { results: SeasonResult[]; fixtures: SeasonFixture[] } {
  const results: SeasonResult[] = [];
  const fixtures: SeasonFixture[] = [];
  for (const raw of firstArray(body, ["fixtures-results", "matches"])) {
    const m = obj(raw);
    const home = obj(m["home-team"] ?? m.home);
    const away = obj(m["away-team"] ?? m.away);
    const date = str(m.date).slice(0, 10);
    if (!date) continue;
    const weAreHome = str(home.name) === teamName;
    const opponent = weAreHome ? str(away.name) : str(home.name);
    const competition = str(obj(m.competition).name || m.competition);
    const hs = num(home.score);
    const as = num(away.score);
    const played = hs !== null && as !== null;
    if (played) {
      const scorersRaw = arr(weAreHome ? home.scorers : away.scorers).map((s) => {
        const o = obj(s);
        return o.name ? `${str(o.name)}${num(o.goals) && num(o.goals)! > 1 ? ` (${num(o.goals)})` : ""}` : str(s);
      });
      results.push({
        match_date: date,
        competition,
        opponent,
        venue: weAreHome ? "H" : "A",
        goals_for: weAreHome ? hs : as,
        goals_against: weAreHome ? as : hs,
        ht_for: num(weAreHome ? home["half-time-score"] : away["half-time-score"]),
        ht_against: num(weAreHome ? away["half-time-score"] : home["half-time-score"]),
        attendance: num(m.attendance),
        scorers: scorersRaw,
        source: "fwp",
      });
    } else {
      fixtures.push({ match_date: date, kickoff: normaliseKickoff(str(m.time)), opponent, venue: weAreHome ? "H" : "A", competition });
    }
  }
  return { results, fixtures };
}

export function mapLeagueTable(body: unknown, teamName: string, asOf: string): SeasonStanding[] {
  return firstArray(body, ["league-table", "teams"]).map((raw, i) => {
    const t = obj(raw);
    const all = obj(t["all-matches"] ?? t);
    const home = obj(t["home-matches"]);
    const away = obj(t["away-matches"]);
    return {
      as_of: asOf,
      position: num(t.position) ?? i + 1,
      team: str(t.name),
      played: num(all.played) ?? 0,
      won: num(all.won) ?? 0,
      drawn: num(all.drawn) ?? 0,
      lost: num(all.lost) ?? 0,
      gf: num(all.for) ?? 0,
      ga: num(all.against) ?? 0,
      gd: num(all["goal-difference"]) ?? (num(all.for) ?? 0) - (num(all.against) ?? 0),
      points: num(all.points) ?? 0,
      home: { p: num(home.played) ?? undefined, w: num(home.won) ?? undefined, d: num(home.drawn) ?? undefined, l: num(home.lost) ?? undefined },
      away: { p: num(away.played) ?? undefined, w: num(away.won) ?? undefined, d: num(away.drawn) ?? undefined, l: num(away.lost) ?? undefined },
      is_us: str(t.name) === teamName,
    };
  });
}

export function mapAppearances(body: unknown): { name: string; apps: number }[] {
  return firstArray(body, ["appearances", "players"]).map((raw) => {
    const p = obj(raw);
    return { name: `${str(p["first-name"])} ${str(p["last-name"])}`.trim() || str(p.name), apps: num(p.appearances) ?? 0 };
  });
}

export async function loadFromFwp(cfg: FwpConfig, teamName: string, asOf: string): Promise<SeasonData> {
  const [fr, table, apps] = await Promise.all([
    get(cfg, SEASON_FEED.endpoints.fixtures, { team: cfg.teamId }),
    get(cfg, SEASON_FEED.endpoints.table, { team: cfg.teamId }),
    get(cfg, SEASON_FEED.endpoints.appearances, { team: cfg.teamId }),
  ]);
  const { results, fixtures } = mapFixturesResults(fr, teamName);
  const standings = mapLeagueTable(table, teamName, asOf);
  const us = standings.find((s) => s.is_us) ?? null;
  const league = results.filter((r) => isLeague(r.competition));
  let pts = 0;
  const progress = league.map((r, i) => {
    pts += r.goals_for > r.goals_against ? 3 : r.goals_for === r.goals_against ? 1 : 0;
    return { match_no: i + 1, match_date: r.match_date, points: pts, position: i === league.length - 1 ? us?.position ?? null : null };
  });
  return { team: teamName, asOf, results, fixtures, standings, progress, appearances: mapAppearances(apps), goals: goalsByScorer(results) };
}
