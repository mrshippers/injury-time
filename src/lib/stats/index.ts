/**
 * Season stats boundary.
 *
 * The default provider is the match log: every match the manager logs in /log
 * carries minutes, goals, assists and cards per player, and the season line is
 * the sum of those rows. That is the only honest source for a Step 5 side -
 * FA Full-Time publishes no API, and the paid feeds (API-Football, apifootball)
 * stop at Step 3 (Isthmian / Southern / Northern Premier).
 *
 * A club higher up the pyramid can swap in an API-backed provider behind this
 * interface without any page changing: the pages only ever see `SeasonStats`.
 */

/** Where a season line came from: the club's own match log, the league feed, or nowhere yet. */
export type StatsSource = "log" | "feed" | "none";

export type SeasonStats = {
  /** Match sessions with any minutes logged. */
  apps: number;
  /** Match sessions with 60+ minutes: a start, near enough, without a lineup record. */
  starts: number;
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
  source?: StatsSource;
};

export type MatchRow = {
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
};

export function emptyStats(): SeasonStats {
  return { apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0, source: "none" };
}

/**
 * The league feed knows games and goals for a player and nothing else. When
 * the club's own log is empty this is the honest season line: apps and goals
 * from the feed, everything else 0, and `source: "feed"` so a page can say so.
 */
export function fromExternalStats(ext: { apps?: number; goals?: number } | null | undefined): SeasonStats {
  if (!ext || (!ext.apps && !ext.goals)) return emptyStats();
  return { apps: ext.apps ?? 0, starts: 0, minutes: 0, goals: ext.goals ?? 0, assists: 0, yellow: 0, red: 0, source: "feed" };
}

/** Pure fold of match rows into a season line. Training rows must not be passed. */
export function sumMatchRows(rows: readonly MatchRow[]): SeasonStats {
  const s = emptyStats();
  for (const r of rows) {
    if (r.minutes <= 0) continue;
    s.apps += 1;
    if (r.minutes >= 60) s.starts += 1;
    s.minutes += r.minutes;
    s.goals += r.goals;
    s.assists += r.assists;
    s.yellow += r.yellow;
    s.red += r.red;
  }
  s.source = s.apps > 0 ? "log" : "none";
  return s;
}

/**
 * Anything that can answer "season line per player" for a club. The logged
 * matches provider lives in `@/lib/data` because it needs the Supabase client;
 * an API adapter would live beside this file and be selected by env.
 */
export interface SeasonStatsProvider {
  readonly source: "logged_matches" | "api_football";
  seasonStats(clubId: string): Promise<Map<string, SeasonStats>>;
}
