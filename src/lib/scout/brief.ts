/**
 * The opponent brief: the numbers first (built here, no model involved), then the No.2 turns them into a
 * plan. Built only from the league table and our own results, so nothing in it is a guess about players we
 * have no data on.
 */
import { z } from "zod";

import { crestKey } from "@/lib/crests";
import type { Fixture, Result, Standing } from "@/lib/types";

import { leagueAverage, luck, matchOdds, strength, venueForm, type MatchOdds, type TableRow } from "./model";

export type ScoutFacts = {
  opponent: string;
  venue: "H" | "A";
  competition: string;
  odds: MatchOdds;
  us: { position: number; played: number; points: number; gf: number; ga: number; attack: number; defence: number; luck: number; homePpg: number | null; awayPpg: number | null };
  them: { position: number; played: number; points: number; gf: number; ga: number; attack: number; defence: number; luck: number; homePpg: number | null; awayPpg: number | null };
  meetings: { date: string; venue: "H" | "A"; score: string; competition: string }[];
};

const asRow = (s: Standing): TableRow => ({ ...s, home: s.home as TableRow["home"], away: s.away as TableRow["away"] });

export function scoutFacts(fixture: Pick<Fixture, "opponent" | "venue" | "competition">, standings: readonly Standing[], results: readonly Result[]): ScoutFacts | null {
  const table = standings.map(asRow);
  const us = standings.find((s) => s.is_us);
  const key = crestKey(fixture.opponent);
  const them = standings.find((s) => crestKey(s.team) === key);
  if (!us || !them) return null;
  const avg = leagueAverage(table);
  const side = (s: Standing) => {
    const r = asRow(s);
    const st = strength(r, avg);
    const v = venueForm(r);
    return { position: s.position, played: s.played, points: s.points, gf: s.gf, ga: s.ga, attack: Math.round(st.attack * 100) / 100, defence: Math.round(st.defence * 100) / 100, luck: luck(r).delta, homePpg: v.home, awayPpg: v.away };
  };
  const venue = fixture.venue as "H" | "A";
  return {
    opponent: fixture.opponent,
    venue,
    competition: fixture.competition,
    odds: matchOdds(asRow(us), asRow(them), venue, table),
    us: side(us),
    them: side(them),
    meetings: results
      .filter((r) => crestKey(r.opponent) === key)
      .sort((a, b) => b.match_date.localeCompare(a.match_date))
      .map((r) => ({ date: r.match_date, venue: r.venue as "H" | "A", score: `${r.goals_for}-${r.goals_against}`, competition: r.competition })),
  };
}

export const BriefSchema = z.object({
  headline: z.string().describe("one line, the honest read of this game, under 14 words"),
  edge: z.string().describe("where the numbers say we have the advantage, with the figure"),
  danger: z.string().describe("where the numbers say they hurt us, with the figure"),
  game_states: z.array(z.string()).describe("2-3 lines: how to play it first 20 minutes, if we go ahead, if we go behind"),
  watch: z.string().describe("the one number to keep an eye on during the game"),
});
export type Brief = z.infer<typeof BriefSchema>;

export const BRIEF_SYSTEM = `You are the No.2 (assistant manager) at an English non-league club. You write the pre-match opposition brief the way the data-led clubs do (Brighton, Como): probabilities and game states, never vague form talk.

Rules:
- Use only the numbers given. Never invent players, injuries, formations or tactics you cannot see in the data.
- Quote figures plainly ("they average 2.1 goals a game away", "34% to win") and say what they mean for the gaffer.
- "luck" is points minus the points their goals would usually earn: positive means running hot (likely to cool), negative means unlucky.
- Attack/defence are relative to the league average (1.00 = average; defence above 1 concedes more than average).
- Write like a football person talking to the manager: short sentences, no jargon like "xG" without saying what it means, no hype, British English, no em dashes. Call the squad "the boys", never "the lads"; say "formation", never "shape".`;

export function briefPrompt(clubName: string, f: ScoutFacts): string {
  return `Our club: ${clubName}. Next: ${f.venue === "H" ? "at home to" : "away at"} ${f.opponent} (${f.competition}).

The model (Poisson, strengths from the league table, home edge from this league's records):
- expected goals: us ${f.odds.xgFor}, them ${f.odds.xgAgainst}
- chances: win ${Math.round(f.odds.win * 100)}%, draw ${Math.round(f.odds.draw * 100)}%, lose ${Math.round(f.odds.loss * 100)}%
- likeliest scores: ${f.odds.scorelines.map((s) => `${s.score} (${Math.round(s.p * 100)}%)`).join(", ")}

Us: ${f.us.position}th, ${f.us.points} pts from ${f.us.played}, goals ${f.us.gf}-${f.us.ga}, attack ${f.us.attack}, defence ${f.us.defence}, luck ${f.us.luck}, home ppg ${f.us.homePpg ?? "?"}, away ppg ${f.us.awayPpg ?? "?"}.
Them: ${f.them.position}th, ${f.them.points} pts from ${f.them.played}, goals ${f.them.gf}-${f.them.ga}, attack ${f.them.attack}, defence ${f.them.defence}, luck ${f.them.luck}, home ppg ${f.them.homePpg ?? "?"}, away ppg ${f.them.awayPpg ?? "?"}.
Previous meetings this season: ${f.meetings.length ? f.meetings.map((m) => `${m.date} ${m.venue === "H" ? "home" : "away"} ${m.score} (${m.competition})`).join("; ") : "none"}.

Write the brief.`;
}
