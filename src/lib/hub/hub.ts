/**
 * The player's hub: their season as a footballer, worked out from what the
 * club logged or the league published. Nothing here is invented: a milestone
 * is only claimed when the rows prove it, and the page says where each number
 * came from. Pure, so it runs in a unit test.
 */
import { matchPlayer, parseScorer } from "@/lib/league/normalise";
import type { SeasonStats } from "@/lib/stats";
import type { Clip, ClipEventKind, Result } from "@/lib/types";

/** one match a player was logged in (session_loads on a match session) */
export type LoggedMatch = {
  date: string;
  opponent: string | null;
  minutes: number;
  goals: number;
  assists: number;
};

export type GoalGame = {
  date: string;
  opponent: string;
  competition: string | null;
  venue: "H" | "A" | null;
  goals: number;
  /** "5-1", ours first, when the result is known */
  score: string | null;
};

export type Milestone = { kind: "first" | "hattrick" | "brace" | "streak" | "apps" | "goals"; title: string; detail: string | null };
export type NextUp = { title: string; left: number };
export type Moment = { clipId: string; title: string; opponent: string | null; date: string | null; t: number; kind: ClipEventKind; note: string | null };

/** only the football: injuries and staff notes stay off a player's own page */
export const MOMENT_KINDS: readonly ClipEventKind[] = ["goal", "save", "chance", "shot", "press", "set_piece"];

/** the position a player picks, said the way they would */
export const POSITION_WORD: Record<string, string> = {
  GK: "goalkeeper", RB: "right back", CB: "centre back", LB: "left back", RWB: "right wing-back", LWB: "left wing-back",
  DM: "holding mid", CM: "centre mid", AM: "number ten", RW: "right wing", LW: "left wing", ST: "striker",
};

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const said = (n: number) => WORDS[n] ?? String(n);

/** The games this player scored in, from the logged matches when there are any, else the league's scorer lists. */
export function goalGames(
  playerId: string,
  roster: readonly { id: string; name: string }[],
  results: readonly Result[],
  logged: readonly LoggedMatch[],
): GoalGame[] {
  const byDate = new Map(results.map((r) => [r.match_date, r]));
  if (logged.length) {
    return logged
      .filter((m) => m.goals > 0)
      .map((m) => {
        const r = byDate.get(m.date);
        return {
          date: m.date,
          opponent: r?.opponent ?? m.opponent ?? "unknown",
          competition: r?.competition ?? null,
          venue: r?.venue ?? null,
          goals: m.goals,
          score: r ? `${r.goals_for}-${r.goals_against}` : null,
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  const out: GoalGame[] = [];
  for (const r of [...results].sort((a, b) => a.match_date.localeCompare(b.match_date))) {
    let goals = 0;
    for (const entry of r.scorers) {
      const s = parseScorer(entry);
      if (s && matchPlayer(s.name, roster)?.id === playerId) goals += s.goals;
    }
    if (goals) out.push({ date: r.match_date, opponent: r.opponent, competition: r.competition, venue: r.venue, goals, score: `${r.goals_for}-${r.goals_against}` });
  }
  return out;
}

/** Longest run of consecutive matches with a goal: the player's own apps when logged, else the club's results in order. */
export function scoringRun(games: readonly GoalGame[], matchDates: readonly string[]): number {
  const scored = new Set(games.map((g) => g.date));
  let best = 0;
  let run = 0;
  for (const d of [...matchDates].sort()) {
    run = scored.has(d) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** ", won 5-1" / ", drew 4-4" / ", lost 2-5"; nothing when the score is unknown */
function outcome(score: string | null): string {
  if (!score) return "";
  const [a, b] = score.split("-").map(Number);
  return `, ${a > b ? "won" : a === b ? "drew" : "lost"} ${score}`;
}

const APPS_MARKS = [10, 25, 50, 100, 150, 200];
const GOAL_MARKS = [5, 10, 15, 20, 25, 30, 40, 50];

export function milestones(games: readonly GoalGame[], stats: SeasonStats, run: number, fmt: (d: string) => string): { won: Milestone[]; next: NextUp[] } {
  const won: Milestone[] = [];
  const first = games[0];
  if (first) won.push({ kind: "first", title: "first goal of the season", detail: `v ${first.opponent}, ${fmt(first.date)}` });
  for (const g of games) {
    if (g.goals >= 3) won.push({ kind: "hattrick", title: g.goals === 3 ? "hat-trick" : `${said(g.goals)} in a game`, detail: `v ${g.opponent}, ${fmt(g.date)}${outcome(g.score)}` });
    else if (g.goals === 2) won.push({ kind: "brace", title: "brace", detail: `v ${g.opponent}, ${fmt(g.date)}` });
  }
  if (run >= 2) won.push({ kind: "streak", title: `scored in ${said(run)} running`, detail: null });
  const appsMark = [...APPS_MARKS].reverse().find((m) => stats.apps >= m);
  if (appsMark) won.push({ kind: "apps", title: `${appsMark} appearances`, detail: "this season" });
  const goalMark = [...GOAL_MARKS].reverse().find((m) => stats.goals >= m);
  if (goalMark) won.push({ kind: "goals", title: goalMark === 10 ? "double figures" : `${goalMark} goals`, detail: "this season" });

  const next: NextUp[] = [];
  const nextApps = APPS_MARKS.find((m) => m > stats.apps);
  if (nextApps && stats.apps > 0) next.push({ title: `${nextApps} appearances`, left: nextApps - stats.apps });
  const nextGoals = GOAL_MARKS.find((m) => m > stats.goals);
  if (nextGoals && stats.goals > 0) next.push({ title: nextGoals === 10 ? "double figures" : `${nextGoals} goals`, left: nextGoals - stats.goals });
  return { won, next };
}

/** Clip events tagged to this player, newest match first, football only. */
export function moments(playerId: string, clips: readonly Clip[]): Moment[] {
  const out: Moment[] = [];
  for (const c of clips) {
    for (const e of c.events ?? []) {
      if (e.player_id !== playerId || !MOMENT_KINDS.includes(e.kind)) continue;
      out.push({ clipId: c.id, title: c.title, opponent: c.opponent, date: c.match_date, t: e.t, kind: e.kind, note: e.note ?? null });
    }
  }
  return out.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.t - b.t);
}

/** Goals per game, said the way a programme would, once there are enough games to mean it. */
export function strikeRate(stats: SeasonStats): string | null {
  if (stats.apps < 5 || stats.goals === 0) return null;
  const every = stats.apps / stats.goals;
  if (every === 1) return "a goal a game";
  if (every <= 1) return `${(stats.goals / stats.apps).toFixed(1)} a game`;
  return `one every ${every % 1 === 0 ? every : every.toFixed(1)} games`;
}
