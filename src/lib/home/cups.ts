/**
 * The cups, read the way a gaffer reads them: each competition is a run of ties,
 * the last one tells you whether you are still in. Feeds name a tie "FA Vase 1Q",
 * "FA Vase 2", "Herts Cup 1", "CCL Div One Challenge Cup 2": the competition is
 * everything before the trailing round token. Pure functions, no I/O.
 */
import type { Fixture, Result } from "@/lib/types";

import { isLeague } from "./season-context";

export type CupTie = {
  round: string;
  opponent: string;
  venue: "H" | "A";
  date: string;
  kickoff?: string | null;
  /** present once played */
  score?: string;
  tone?: "win" | "draw" | "loss";
};

export type CupRun = {
  name: string;
  /** played ties then, last, the next one if the diary has it */
  ties: CupTie[];
  state: "in" | "out" | "waiting";
  /** one plain sentence for the run */
  line: string;
};

const ORD: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6 };
const ROUND_WORDS = "(?:(?:first|second|third|fourth|fifth|sixth|\\d+(?:st|nd|rd|th)?)\\s+(?:qualifying(?:\\s+round)?|round)|round\\s+\\d+|prelim(?:inary)?(?:\\s+round)?|(?:semi|quarter)[- ]?finals?|final|\\d+Q?|Q\\d)";
const TOKEN = new RegExp(`^(.*?)\\s+(${ROUND_WORDS})(\\s+replay)?$`, "i");

/**
 * "FA Vase 1Q" -> { name: "FA Vase", token: "1Q" }; "FA Cup Preliminary replay" -> { name: "FA Cup", token: "Preliminary replay" };
 * "FA Vase First Qualifying" -> { name: "FA Vase", token: "First Qualifying" }. No trailing round -> the whole string is the name.
 */
export function splitCompetition(competition: string): { name: string; token: string | null } {
  const m = competition.trim().match(TOKEN);
  return m ? { name: m[1].trim(), token: `${m[2]}${m[3] ?? ""}`.trim() } : { name: competition.trim(), token: null };
}

/** "1Q" -> "1st qualifying round"; "2" -> "round 2"; "First Qualifying" -> "1st qualifying round"; "Preliminary replay" -> "preliminary round replay"; none -> "tie". */
export function roundLabel(token: string | null): string {
  if (!token) return "tie";
  const replay = /\s+replay$/i.test(token) ? " replay" : "";
  const t = token.replace(/\s+replay$/i, "").trim();
  const q = t.match(/^(\d+)Q$/i);
  if (q) return `${ordinalWord(Number(q[1]))} qualifying round${replay}`;
  if (/^\d+$/.test(t)) return `round ${t}${replay}`;
  if (/^Q(\d)$/i.test(t)) return `${ordinalWord(Number(t.slice(1)))} qualifying round${replay}`;
  const w = t.match(/^(first|second|third|fourth|fifth|sixth|\d+)(?:st|nd|rd|th)?\s+(qualifying|round)/i);
  if (w) {
    const n = ORD[w[1].toLowerCase()] ?? Number(w[1]);
    return w[2].toLowerCase() === "qualifying" ? `${ordinalWord(n)} qualifying round${replay}` : `round ${n}${replay}`;
  }
  const r = t.match(/^round\s+(\d+)$/i);
  if (r) return `round ${r[1]}${replay}`;
  if (/^prelim/i.test(t)) return `preliminary round${replay}`;
  return `${t.toLowerCase()}${replay}`;
}

/** "round 2" -> "in round 2"; "1st qualifying round" -> "in the 1st qualifying round". */
const inRound = (label: string) => (label.startsWith("round") || label === "tie" ? `in ${label}` : `in the ${label}`);

function ordinalWord(n: number): string {
  return ["", "1st", "2nd", "3rd", "4th", "5th", "6th"][n] ?? `${n}th`;
}

const toneOf = (r: Pick<Result, "goals_for" | "goals_against">): CupTie["tone"] => (r.goals_for > r.goals_against ? "win" : r.goals_for === r.goals_against ? "draw" : "loss");

export function cupRuns(results: readonly Result[], fixtures: readonly Fixture[], asOf: string): CupRun[] {
  const byName = new Map<string, CupTie[]>();
  const add = (name: string, tie: CupTie) => byName.set(name, [...(byName.get(name) ?? []), tie]);

  for (const r of results) {
    if (isLeague(r.competition)) continue;
    const { name, token } = splitCompetition(r.competition);
    add(name, { round: roundLabel(token), opponent: r.opponent, venue: r.venue, date: r.match_date, score: `${r.goals_for}-${r.goals_against}`, tone: toneOf(r) });
  }
  for (const f of fixtures) {
    if (isLeague(f.competition) || f.match_date < asOf) continue;
    const { name, token } = splitCompetition(f.competition);
    add(name, { round: roundLabel(token), opponent: f.opponent, venue: f.venue, date: f.match_date, kickoff: f.kickoff });
  }

  const runs: CupRun[] = [];
  for (const [name, ties] of byName) {
    ties.sort((a, b) => a.date.localeCompare(b.date));
    const played = ties.filter((t) => t.tone);
    const next = ties.find((t) => !t.tone);
    const lastPlayed = played.at(-1);
    // a drawn cup tie goes to extra time and penalties; the feed's score is the 90/120, so a draw is not a verdict
    const out = lastPlayed?.tone === "loss" && !next;
    const state: CupRun["state"] = out ? "out" : next ? "in" : "waiting";
    const line = out
      ? `out ${inRound(lastPlayed!.round)}, ${lastPlayed!.score} ${lastPlayed!.venue === "A" ? "at" : "v"} ${lastPlayed!.opponent}`
      : next
        ? `through, ${next.venue === "H" ? "at home to" : "away at"} ${next.opponent} ${inRound(next.round)}`
        : lastPlayed
          ? `through ${lastPlayed.round.replace(/^round/, "round")}, waiting on the draw`
          : "not started";
    runs.push({ name, ties, state, line });
  }
  // runs still alive first, then by most recent tie
  return runs.sort((a, b) => Number(b.state === "in") - Number(a.state === "in") || b.ties.at(-1)!.date.localeCompare(a.ties.at(-1)!.date));
}

/** The last game played in any competition, for the "last time out" line. */
export function lastResult(results: readonly Result[]): Result | null {
  return [...results].sort((a, b) => b.match_date.localeCompare(a.match_date))[0] ?? null;
}
