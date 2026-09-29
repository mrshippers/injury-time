/**
 * A result the club enters itself: the manager was there, so this is the most
 * trustworthy source there is. Pure validation, so the rules are tested once.
 */
import type { SeasonResult } from "@/lib/league/normalise";
import type { Venue } from "@/lib/types";

export type ResultInput = {
  matchDate: string;
  opponent: string;
  venue: string;
  competition: string;
  goalsFor: string | number;
  goalsAgainst: string | number;
  /** comma or newline separated, "Name" or "Name 2" for a brace */
  scorers?: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseResultInput(input: ResultInput, today: string): { ok: true; result: SeasonResult } | { ok: false; error: string } {
  const matchDate = String(input.matchDate ?? "").trim();
  if (!DATE_RE.test(matchDate) || Number.isNaN(Date.parse(matchDate))) return { ok: false, error: "the match date is not a date" };
  if (matchDate > today) return { ok: false, error: "that match has not been played yet" };

  const opponent = String(input.opponent ?? "").trim().replace(/\s+/g, " ");
  if (opponent.length < 2 || opponent.length > 80) return { ok: false, error: "name the opposition" };

  const v = String(input.venue ?? "").toUpperCase();
  if (v !== "H" && v !== "A") return { ok: false, error: "home or away?" };
  const venue: Venue = v;

  const competition = String(input.competition ?? "").trim().replace(/\s+/g, " ") || "League";
  if (competition.length > 80) return { ok: false, error: "the competition name is too long" };

  const gf = Number(input.goalsFor);
  const ga = Number(input.goalsAgainst);
  if (!Number.isInteger(gf) || !Number.isInteger(ga) || gf < 0 || ga < 0 || gf > 30 || ga > 30) {
    return { ok: false, error: "the score is not a score" };
  }

  const scorers = String(input.scorers ?? "")
    .split(/[,\n]/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean)
    .slice(0, 30);
  const scored = scorers.reduce((n, s) => n + (Number(s.match(/\s(\d{1,2})$/)?.[1]) || 1), 0);
  if (scored > gf) return { ok: false, error: `${scored} goals named, ${gf} scored` };

  return {
    ok: true,
    result: {
      match_date: matchDate,
      competition,
      opponent,
      venue,
      goals_for: gf,
      goals_against: ga,
      ht_for: null,
      ht_against: null,
      attendance: null,
      scorers,
      source: "manual",
    },
  };
}
