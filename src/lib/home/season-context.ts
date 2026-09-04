/**
 * The season, read the way a gaffer reads it: points a game, where that
 * lands at Christmas and in May, what the top two are doing. Pure functions
 * over the league feed; nothing here touches the database.
 */
import { SEASON_BENCHMARKS } from "@/lib/config";
import type { Fixture, ProgressPoint, Result, Standing } from "@/lib/types";

const CUP = /cup|vase|trophy|shield|plate/i;

/** A league game is anything that is not a cup tie. */
export function isLeague(competition: string): boolean {
  return !CUP.test(competition);
}

/** `2026-12-25` for a season that starts in 2026. */
export function christmasFor(seasonStartIso: string): string {
  const year = Number(seasonStartIso.slice(0, 4));
  return `${year}-${SEASON_BENCHMARKS.christmasCutoff}`;
}

export type FormMark = { result: "W" | "D" | "L"; score: string; opponent: string; venue: "H" | "A"; date: string };

export type SeasonContext = {
  hasSeason: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  ppg: number;
  position: number | null;
  teams: number;
  gf: number;
  ga: number;
  /** what this pace gives at the end of the season */
  projected: number;
  leagueGamesToChristmas: number;
  /** points on Christmas Day if the pace holds */
  atChristmasOnPace: number;
  /** points on Christmas Day at promotion pace from here */
  atChristmasOnPromotionPace: number;
  /** wins needed from the games to Christmas to be on promotion pace on the day */
  winsToChristmasForPromotionPace: number;
  /** points behind promotion pace, now */
  behindPromotionPace: number;
  gapToSecond: number | null;
  gapToFifth: number | null;
  form: FormMark[];
  /** longest unbeaten and losing runs this season, in games */
  bestRun: number;
  worstRun: number;
  /** cumulative points after each league game, for the line */
  line: { matchNo: number; date: string; points: number }[];
  sentences: string[];
};

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty"];
export function word(n: number): string {
  return n >= 0 && n < WORDS.length ? WORDS[n] : String(n);
}

function pts(r: Result): 3 | 1 | 0 {
  if (r.goals_for > r.goals_against) return 3;
  if (r.goals_for === r.goals_against) return 1;
  return 0;
}

export function formFrom(results: Result[], n = 6): FormMark[] {
  return [...results]
    .filter((r) => isLeague(r.competition))
    .sort((a, b) => a.match_date.localeCompare(b.match_date))
    .slice(-n)
    .map((r) => ({
      result: pts(r) === 3 ? "W" : pts(r) === 1 ? "D" : "L",
      score: `${r.goals_for}-${r.goals_against}`,
      opponent: r.opponent,
      venue: r.venue,
      date: r.match_date,
    }));
}

function runs(results: Result[]): { best: number; worst: number } {
  let best = 0;
  let worst = 0;
  let unbeaten = 0;
  let losing = 0;
  for (const r of results) {
    if (pts(r) > 0) {
      unbeaten += 1;
      losing = 0;
    } else {
      losing += 1;
      unbeaten = 0;
    }
    best = Math.max(best, unbeaten);
    worst = Math.max(worst, losing);
  }
  return { best, worst };
}

export function seasonContext(input: {
  results: Result[];
  standings: Standing[];
  progress: ProgressPoint[];
  fixtures: Fixture[];
  asOf: string;
}): SeasonContext {
  const league = [...input.results].filter((r) => isLeague(r.competition)).sort((a, b) => a.match_date.localeCompare(b.match_date));
  const us = input.standings.find((s) => s.is_us) ?? null;
  const teams = input.standings.length;

  const played = us?.played ?? league.length;
  const won = us?.won ?? league.filter((r) => pts(r) === 3).length;
  const drawn = us?.drawn ?? league.filter((r) => pts(r) === 1).length;
  const lost = us?.lost ?? league.filter((r) => pts(r) === 0).length;
  const points = us?.points ?? league.reduce((t, r) => t + pts(r), 0);
  const gf = us?.gf ?? league.reduce((t, r) => t + r.goals_for, 0);
  const ga = us?.ga ?? league.reduce((t, r) => t + r.goals_against, 0);
  const hasSeason = played > 0;
  const ppg = played > 0 ? points / played : 0;

  const games = SEASON_BENCHMARKS.gamesInSeason;
  const projected = Math.round(ppg * games);

  const firstDate = league[0]?.match_date ?? input.asOf;
  const xmas = christmasFor(firstDate);
  const toXmas = input.fixtures.filter((f) => isLeague(f.competition) && f.match_date > input.asOf && f.match_date <= xmas).length;
  const atChristmasOnPace = Math.round(points + ppg * toXmas);
  const atChristmasOnPromotionPace = Math.round(SEASON_BENCHMARKS.promotionPpg * (played + toXmas));
  const needed = Math.max(0, atChristmasOnPromotionPace - points);
  const winsToChristmasForPromotionPace = Math.min(toXmas, Math.ceil(needed / 3));
  const behindPromotionPace = Math.max(0, Math.round(SEASON_BENCHMARKS.promotionPpg * played - points));

  const second = input.standings.find((s) => s.position === 2) ?? null;
  const fifth = input.standings.find((s) => s.position === 5) ?? null;
  const gapToSecond = second && us ? second.points - us.points : null;
  const gapToFifth = fifth && us ? fifth.points - us.points : null;

  // the line comes from the feed's progress when it has it, else from results
  let line: SeasonContext["line"];
  if (input.progress.length > 0) {
    line = [...input.progress].sort((a, b) => a.match_no - b.match_no).map((p) => ({ matchNo: p.match_no, date: p.match_date, points: p.points }));
  } else {
    let total = 0;
    line = league.map((r, i) => {
      total += pts(r);
      return { matchNo: i + 1, date: r.match_date, points: total };
    });
  }

  const { best, worst } = runs(league);
  const form = formFrom(league);

  const sentences: string[] = [];
  if (!hasSeason) {
    sentences.push("no league games in yet. the line starts with the first result.");
  } else {
    const rounded = Math.round(ppg * 10) / 10;
    const ppgWord = Number.isInteger(rounded) ? `${word(rounded)} a game` : `${rounded.toFixed(1)} a game`;
    sentences.push(`${word(won)} win${won === 1 ? "" : "s"} from ${word(played)}, ${ppgWord}.`);
    if (toXmas > 0) {
      const tag =
        ppg >= SEASON_BENCHMARKS.promotionPpg
          ? "that is promotion pace"
          : ppg >= SEASON_BENCHMARKS.playoffPpg
            ? "that is a play-off shout"
            : ppg >= SEASON_BENCHMARKS.midTablePpg
              ? "that is mid-table"
              : "that is the wrong end";
      sentences.push(`keep that to christmas and you're on ${atChristmasOnPace}, ${tag}.`);
      sentences.push(
        `${word(winsToChristmasForPromotionPace)} wins from the ${word(toXmas)} league games before christmas ${ppg >= SEASON_BENCHMARKS.promotionPpg ? "keeps" : "puts"} you on promotion pace on the day.`,
      );
    }
    if (us && gapToSecond !== null && gapToSecond > 0) {
      sentences.push(`${gapToSecond} point${gapToSecond === 1 ? "" : "s"} off second${gapToFifth !== null && gapToFifth > 0 ? `, ${gapToFifth} off the play-offs` : ""}.`);
    } else if (us && us.position <= 2) {
      sentences.push("in the top two. hold it.");
    }
    if (best >= 4) sentences.push(`best run: ${word(best)} unbeaten.`);
    if (worst >= 3) sentences.push(`worst run: ${word(worst)} without a win.`);
  }

  return {
    hasSeason,
    played,
    won,
    drawn,
    lost,
    points,
    ppg,
    position: us?.position ?? null,
    teams,
    gf,
    ga,
    projected,
    leagueGamesToChristmas: toXmas,
    atChristmasOnPace,
    atChristmasOnPromotionPace,
    winsToChristmasForPromotionPace,
    behindPromotionPace,
    gapToSecond,
    gapToFifth,
    form,
    bestRun: best,
    worstRun: worst,
    line,
    sentences,
  };
}

/** Ordinal for a league position: 6 -> "6th". */
export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
