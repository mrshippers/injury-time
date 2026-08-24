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
};

export type MatchRow = {
  minutes: number;
  goals: number;
  assists: number;
  yellow: number;
  red: number;
};

export function emptyStats(): SeasonStats {
  return { apps: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
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
