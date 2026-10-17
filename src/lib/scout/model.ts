/**
 * The opposition, read the way the analytics clubs read it: not "they're decent", but how many goals each
 * side should score against the other, what that makes the result, and whether their league position is
 * the real them or a run of luck. Pure maths over the league table and our results; no I/O.
 *
 * - Strengths: goals scored and conceded per game against the league average, shrunk toward average over a
 *   few phantom games so a club with five matches isn't judged on five matches.
 * - Venue: home advantage measured from this league's own home and away records, not assumed.
 * - The match: two independent Poisson scorelines (the standard first model for football), giving win,
 *   draw and loss chances and the likeliest scores.
 * - Running hot or cold: the points their goals "should" have earned against the points they have.
 */
export type TableRow = {
  team: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  points: number;
  home?: { p: number; w: number; d: number; l: number } | null;
  away?: { p: number; w: number; d: number; l: number } | null;
};

export type Meeting = { match_date: string; venue: "H" | "A"; goals_for: number; goals_against: number; competition: string };

const PRIOR_GAMES = 3;

function poisson(k: number, l: number): number {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.exp(-l) * l ** k) / f;
}

export function leagueAverage(table: readonly TableRow[]): number {
  const p = table.reduce((n, t) => n + t.played, 0);
  return p ? table.reduce((n, t) => n + t.gf, 0) / p : 1.4;
}

/** Attack and defence relative to the league average (1 = average), shrunk toward 1 for small samples. */
export function strength(t: TableRow, avg: number): { attack: number; defence: number } {
  return {
    attack: (t.gf + avg * PRIOR_GAMES) / (t.played + PRIOR_GAMES) / avg,
    defence: (t.ga + avg * PRIOR_GAMES) / (t.played + PRIOR_GAMES) / avg,
  };
}

/** How much a home side's scoring is lifted in this league, from the table's own home/away points. */
export function homeEdge(table: readonly TableRow[]): number {
  let hp = 0, hg = 0, ap = 0, ag = 0;
  for (const t of table) {
    if (t.home) { hp += t.home.w * 3 + t.home.d; hg += t.home.p; }
    if (t.away) { ap += t.away.w * 3 + t.away.d; ag += t.away.p; }
  }
  if (!hg || !ag || !ap) return 1.1;
  const ratio = hp / hg / (ap / ag);
  // points ratio to a goals multiplier: a square root keeps it in the range real leagues show (1.05-1.35)
  return Math.min(1.4, Math.max(1, Math.sqrt(ratio)));
}

export type MatchOdds = {
  xgFor: number;
  xgAgainst: number;
  win: number;
  draw: number;
  loss: number;
  scorelines: { score: string; p: number }[];
};

export function matchOdds(us: TableRow, them: TableRow, venue: "H" | "A", table: readonly TableRow[]): MatchOdds {
  const avg = leagueAverage(table);
  const h = homeEdge(table);
  const a = strength(us, avg);
  const b = strength(them, avg);
  const lift = venue === "H" ? h : 1 / h;
  const xgFor = avg * a.attack * b.defence * lift;
  const xgAgainst = avg * b.attack * a.defence / lift;
  let win = 0, draw = 0, loss = 0;
  const lines: { score: string; p: number }[] = [];
  for (let i = 0; i <= 9; i++) {
    for (let j = 0; j <= 9; j++) {
      const p = poisson(i, xgFor) * poisson(j, xgAgainst);
      if (i > j) win += p;
      else if (i === j) draw += p;
      else loss += p;
      lines.push({ score: `${i}-${j}`, p });
    }
  }
  const total = win + draw + loss;
  return {
    xgFor: round(xgFor, 2),
    xgAgainst: round(xgAgainst, 2),
    win: round(win / total, 3),
    draw: round(draw / total, 3),
    loss: round(loss / total, 3),
    scorelines: lines.sort((x, y) => y.p - x.p).slice(0, 3).map((l) => ({ score: l.score, p: round(l.p / total, 3) })),
  };
}

/** Points their goals should have earned (each game as a Poisson draw at their season rates) against actual. */
export function luck(t: TableRow): { expected: number; actual: number; delta: number } {
  if (!t.played) return { expected: 0, actual: 0, delta: 0 };
  const lf = t.gf / t.played, la = t.ga / t.played;
  let w = 0, d = 0;
  for (let i = 0; i <= 9; i++) for (let j = 0; j <= 9; j++) {
    const p = poisson(i, lf) * poisson(j, la);
    if (i > j) w += p;
    else if (i === j) d += p;
  }
  const expected = round((w * 3 + d) * t.played, 1);
  return { expected, actual: t.points, delta: round(t.points - expected, 1) };
}

/** Points a game at home and away, where the table gives the split. */
export function venueForm(t: TableRow): { home: number | null; away: number | null } {
  const ppg = (s?: { p: number; w: number; d: number } | null) => (s && s.p ? round((s.w * 3 + s.d) / s.p, 2) : null);
  return { home: ppg(t.home), away: ppg(t.away) };
}

const round = (n: number, dp: number) => Math.round(n * 10 ** dp) / 10 ** dp;
