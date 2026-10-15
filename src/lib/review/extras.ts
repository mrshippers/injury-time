/**
 * The rest of the season review: what a committee asks after the league table.
 * Every figure is counted from results the club or its feed holds; a figure the
 * data cannot support (goals by half where a result has no half-time score) says
 * how many games it could count, never a guess. Pure functions, no I/O.
 */
import { isLeague } from "@/lib/league";
import { parseScorer } from "@/lib/league/normalise";

export type ReviewGame = {
  match_date: string;
  competition: string;
  opponent: string;
  venue: "H" | "A";
  goals_for: number;
  goals_against: number;
  ht_for: number | null;
  ht_against: number | null;
  attendance: number | null;
  scorers: string[];
};

export type Record3 = { played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number };

export function recordOf(games: readonly ReviewGame[]): Record3 {
  const won = games.filter((g) => g.goals_for > g.goals_against).length;
  const drawn = games.filter((g) => g.goals_for === g.goals_against).length;
  return {
    played: games.length,
    won,
    drawn,
    lost: games.length - won - drawn,
    gf: games.reduce((n, g) => n + g.goals_for, 0),
    ga: games.reduce((n, g) => n + g.goals_against, 0),
    points: won * 3 + drawn,
  };
}

export const leagueOnly = (games: readonly ReviewGame[]) => games.filter((g) => isLeague(g.competition));
export const cupsOnly = (games: readonly ReviewGame[]) => games.filter((g) => !isLeague(g.competition));

/** Home and away, side by side: the split that usually explains a mid-table season. */
export function venueSplit(games: readonly ReviewGame[]): { home: Record3; away: Record3 } {
  return { home: recordOf(games.filter((g) => g.venue === "H")), away: recordOf(games.filter((g) => g.venue === "A")) };
}

export function cleanSheets(games: readonly ReviewGame[]): { kept: number; failedToScore: number } {
  return { kept: games.filter((g) => g.goals_against === 0).length, failedToScore: games.filter((g) => g.goals_for === 0).length };
}

/**
 * Goals by half, over only the games that have a half-time score. `counted` is how many that is, so the
 * page can say "from 17 of 20 games" rather than pretend.
 */
export function halves(games: readonly ReviewGame[]): { counted: number; scoredFirst: number; scoredSecond: number; concededFirst: number; concededSecond: number } {
  const have = games.filter((g) => g.ht_for !== null && g.ht_against !== null);
  const out = { counted: have.length, scoredFirst: 0, scoredSecond: 0, concededFirst: 0, concededSecond: 0 };
  for (const g of have) {
    out.scoredFirst += g.ht_for!;
    out.scoredSecond += g.goals_for - g.ht_for!;
    out.concededFirst += g.ht_against!;
    out.concededSecond += g.goals_against - g.ht_against!;
  }
  return out;
}

export function extremes(games: readonly ReviewGame[]): { biggestWin: ReviewGame | null; heaviestDefeat: ReviewGame | null } {
  let biggestWin: ReviewGame | null = null;
  let heaviestDefeat: ReviewGame | null = null;
  for (const g of games) {
    const d = g.goals_for - g.goals_against;
    if (d > 0 && (!biggestWin || d > biggestWin.goals_for - biggestWin.goals_against)) biggestWin = g;
    if (d < 0 && (!heaviestDefeat || d < heaviestDefeat.goals_for - heaviestDefeat.goals_against)) heaviestDefeat = g;
  }
  return { biggestWin, heaviestDefeat };
}

export function homeCrowds(games: readonly ReviewGame[]): { counted: number; average: number; best: ReviewGame | null; lowest: ReviewGame | null } {
  const home = games.filter((g) => g.venue === "H" && g.attendance !== null);
  if (home.length === 0) return { counted: 0, average: 0, best: null, lowest: null };
  const sorted = [...home].sort((a, b) => (b.attendance as number) - (a.attendance as number));
  return {
    counted: home.length,
    average: Math.round(home.reduce((n, g) => n + (g.attendance as number), 0) / home.length),
    best: sorted[0],
    lowest: sorted[sorted.length - 1],
  };
}

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** League points a game, month by month, so a bad September is a bad September and not a vague feeling. */
export function monthly(league: readonly ReviewGame[]): { key: string; label: string; played: number; points: number; ppg: number }[] {
  const by = new Map<string, ReviewGame[]>();
  for (const g of league) by.set(g.match_date.slice(0, 7), [...(by.get(g.match_date.slice(0, 7)) ?? []), g]);
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, games]) => {
      const r = recordOf(games);
      return { key, label: MONTH[Number(key.slice(5, 7)) - 1], played: r.played, points: r.points, ppg: Math.round((r.points / r.played) * 100) / 100 };
    });
}

export type Runs = { unbeaten: number; winless: number; winning: number; current: { kind: "unbeaten" | "winless"; games: number } | null };

export function runsOf(games: readonly ReviewGame[]): Runs {
  const ordered = [...games].sort((a, b) => a.match_date.localeCompare(b.match_date));
  let unbeaten = 0, winless = 0, winning = 0, u = 0, w = 0, ww = 0;
  for (const g of ordered) {
    const r = g.goals_for > g.goals_against ? "W" : g.goals_for === g.goals_against ? "D" : "L";
    u = r === "L" ? 0 : u + 1;
    w = r === "W" ? 0 : w + 1;
    ww = r === "W" ? ww + 1 : 0;
    unbeaten = Math.max(unbeaten, u);
    winless = Math.max(winless, w);
    winning = Math.max(winning, ww);
  }
  const current = ordered.length === 0 ? null : u > 0 ? { kind: "unbeaten" as const, games: u } : { kind: "winless" as const, games: w };
  return { unbeaten, winless, winning, current };
}

export type ScorerRow = { name: string; goals: number; braces: number; hatTricks: number; apps: number | null; perGame: number | null };

/**
 * Scorers from the result sheets, case-blind ("Mcnally" and "McNally" are one man), joined to the squad
 * by `resolve` when it can name exactly one player. Own goals are not ours. Apps come from the feed, so a
 * player the feed does not list shows no rate rather than an invented one.
 */
export function scorerRows(games: readonly ReviewGame[], resolve: (feedName: string) => { name: string; apps: number | null } | null): ScorerRow[] {
  const by = new Map<string, ScorerRow>();
  for (const g of games) {
    const perGame = new Map<string, number>();
    for (const entry of g.scorers) {
      const p = parseScorer(entry);
      if (!p) continue;
      perGame.set(p.name.toLowerCase(), (perGame.get(p.name.toLowerCase()) ?? 0) + p.goals);
    }
    for (const entry of g.scorers) {
      const p = parseScorer(entry);
      if (!p) continue;
      const key = p.name.toLowerCase();
      const n = perGame.get(key);
      if (n === undefined) continue; // this scorer's goals for the game already counted once
      const who = resolve(p.name);
      const row = by.get(key) ?? { name: who?.name ?? p.name, goals: 0, braces: 0, hatTricks: 0, apps: who?.apps ?? null, perGame: null };
      row.goals += n;
      if (n === 2) row.braces += 1;
      if (n >= 3) row.hatTricks += 1;
      by.set(key, row);
      perGame.delete(key);
    }
  }
  return [...by.values()]
    .map((r) => ({ ...r, perGame: r.apps ? Math.round((r.goals / r.apps) * 100) / 100 : null }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

const WORD = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
const w = (n: number) => (n >= 0 && n < WORD.length ? WORD[n] : String(n));
const wins = (n: number) => `${w(n)} win${n === 1 ? "" : "s"}`;

/** The review in three plain sentences, each one counted: the venue split, the cups, the goals. */
export function reviewSentences(input: { split: { home: Record3; away: Record3 }; cups: Record3; cupsStillIn: string[]; cleanSheets: number; leaguePlayed: number }): string[] {
  const out: string[] = [];
  const { home, away } = input.split;
  if (home.played > 0 && away.played > 0) {
    const h = home.lost === 0 ? `Unbeaten at home in the league: ${wins(home.won)}${home.drawn ? ` and ${home.drawn === 1 ? "a draw" : `${w(home.drawn)} draws`}` : ""} from ${w(home.played)}` : `${wins(home.won)} from ${w(home.played)} at home`;
    out.push(`${h}; ${wins(away.won)} from ${w(away.played)} away.`);
  }
  if (input.cups.played > 0) {
    const still = input.cupsStillIn.length ? ` Still in the ${input.cupsStillIn.join(" and the ")}.` : "";
    const c = input.cups;
    const parts = [c.won ? `${w(c.won)} won` : "", c.drawn ? `${w(c.drawn)} drawn` : "", c.lost ? `${w(c.lost)} lost` : ""].filter(Boolean);
    out.push(`${c.drawn + c.lost === 0 ? `In the cups: ${wins(c.won)}` : `In the cups: ${parts.join(", ")}`} from ${w(c.played)}.${still}`);
  }
  if (input.leaguePlayed > 0) out.push(`${input.cleanSheets === 0 ? "No clean sheets" : `${w(input.cleanSheets)} clean sheet${input.cleanSheets === 1 ? "" : "s"}`} in ${w(input.leaguePlayed)} league games.`);
  return out.map((x) => x.charAt(0).toUpperCase() + x.slice(1));
}

/**
 * What happened after half time, over games with a half-time score: points won from behind, points thrown
 * away from in front. The one number a manager actually argues about at the bar, counted, not felt.
 */
export function halfTimeSwings(games: readonly ReviewGame[]): { counted: number; wonFromBehind: number; behindAtHt: number; droppedFromAhead: number; aheadAtHt: number } {
  const have = games.filter((g) => g.ht_for !== null && g.ht_against !== null);
  const pts = (g: ReviewGame) => (g.goals_for > g.goals_against ? 3 : g.goals_for === g.goals_against ? 1 : 0);
  const behind = have.filter((g) => g.ht_for! < g.ht_against!);
  const ahead = have.filter((g) => g.ht_for! > g.ht_against!);
  return {
    counted: have.length,
    behindAtHt: behind.length,
    wonFromBehind: behind.reduce((n, g) => n + pts(g), 0),
    aheadAtHt: ahead.length,
    droppedFromAhead: ahead.reduce((n, g) => n + (3 - pts(g)), 0),
  };
}
