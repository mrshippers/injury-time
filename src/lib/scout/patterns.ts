/**
 * Patterns, not just game-to-game numbers. A set of questions is put to our results and to every league
 * table snapshot; only the answers that stand out come back, ranked by how strongly they stand out and how
 * much they bear on this game (an away pattern counts for more before an away game). Each one is worded
 * for what it found: a lead never thrown away reads differently from leads that keep slipping, and the
 * wording varies by fixture so the read never sounds like one sentence with the numbers swapped.
 * Small samples are held back: three games is an anecdote, not a pattern. Pure, no I/O.
 */
import { crestKey } from "@/lib/crests";
import type { Result, Standing } from "@/lib/types";

export type Finding = { key: string; heading: string; line: string; strength: number; about: "us" | "them" | "h2h" };

type Ctx = {
  opponent: string;
  venue: "H" | "A";
  competition: string;
  date: string;
  results: readonly Result[];
  table: readonly Standing[];
  history: readonly Standing[];
};

/* ── wording ── */

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
/** One of several ways to say it, fixed per fixture so a reload doesn't reshuffle the page. */
function say(c: Ctx, key: string, variants: string[]): string {
  return variants[hash(`${c.opponent}|${c.date}|${key}`) % variants.length];
}
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);
const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const ptsA = (n: number) => `${r2(n)} point${r2(n) === 1 ? "" : "s"} a game`;
/** Rank as a phrase: 1 -> "the league's tightest", last -> "the league's leakiest", else "9th-tightest". */
const rankWord = (r: number, n: number, best: string, worst: string) => (r === 1 ? `the league's ${best}` : r === n ? `the league's ${worst}` : `${ord(r)}-${best}`);
const pts = (r: Result) => (r.goals_for > r.goals_against ? 3 : r.goals_for === r.goals_against ? 1 : 0);
const ppg = (rs: readonly Result[]) => (rs.length ? rs.reduce((n, r) => n + pts(r), 0) / rs.length : 0);
const score = (r: Result) => `${r.goals_for}-${r.goals_against}`;
const day = 86_400_000;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const venueWord = (v: "H" | "A") => (v === "H" ? "at home" : "away");

/** "Mcnally (2, 1 pen)" -> { name: "McNally", goals: 2 }. Case-folds so "Mcnally" and "McNally" are one man. */
export function parseScorer(raw: string): { key: string; name: string; goals: number } {
  const m = raw.match(/^(.*?)\s*(?:\((\d+)?[^)]*\))?\s*$/);
  const name = (m?.[1] ?? raw).trim();
  return { key: name.toLowerCase().replace(/[^a-z]/g, ""), name, goals: m?.[2] ? Number(m[2]) : 1 };
}

/* ── us ── */

function halfTime(c: Ctx): Finding[] {
  const ht = c.results.filter((r) => r.ht_for !== null && r.ht_against !== null);
  const out: Finding[] = [];
  const ahead = ht.filter((r) => r.ht_for! > r.ht_against!);
  const behind = ht.filter((r) => r.ht_for! < r.ht_against!);
  const level = ht.filter((r) => r.ht_for === r.ht_against);

  if (ahead.length >= 4) {
    const dropped = ahead.filter((r) => r.goals_for <= r.goals_against);
    const n = ahead.length;
    out.push(
      dropped.length === 0
        ? {
            key: "leads",
            heading: "half-time leads",
            about: "us",
            strength: clamp(0.45 + n * 0.04),
            line: say(c, "leads0", [
              `Ahead at half time ${n} times, won every one of them.`,
              `We've never let a half-time lead go: ${n} from ${n}.`,
              `Get in front by the break and it's done. ${n} half-time leads, ${n} wins.`,
            ]),
          }
        : {
            key: "leads",
            heading: "half-time leads",
            about: "us",
            strength: clamp((dropped.length / n) * 1.2),
            line: say(c, "leads1", [
              `We've let ${dropped.length} of ${n} half-time leads slip, most recently ${dropped.at(-1)!.opponent} (${score(dropped.at(-1)!)}).`,
              `Leads haven't been safe: ${dropped.length} dropped from ${n} ahead at the break.`,
            ]),
          },
    );
  }

  if (behind.length >= 3) {
    const won = behind.filter((r) => r.goals_for > r.goals_against);
    const drew = behind.filter((r) => r.goals_for === r.goals_against);
    const got = won.length + drew.length;
    const latest = [...won, ...drew].sort((a, b) => b.match_date.localeCompare(a.match_date))[0];
    out.push(
      got === 0
        ? {
            key: "comebacks",
            heading: "from behind",
            about: "us",
            strength: clamp(0.62 + behind.length * 0.04),
            line: say(c, "cb0", [
              `We haven't come from behind yet: behind at half time ${behind.length} times, lost all ${behind.length}.`,
              `No comebacks yet. ${behind.length} games behind at the break, ${behind.length} defeats.`,
            ]),
          }
        : {
            key: "comebacks",
            heading: "from behind",
            about: "us",
            strength: clamp(0.62 + (got / behind.length) * 0.3),
            line:
              won.length > 0
                ? say(c, "cb1", [
                    `We've come from behind at half time to win ${times(won.length)}${drew.length ? ` and draw ${times(drew.length)}` : ""}, the latest ${latest.opponent} (${score(latest)} from ${latest.ht_for}-${latest.ht_against}).`,
                    `We've come from behind ${times(got)} this season: ${won.length} win${won.length === 1 ? "" : "s"}${drew.length ? `, ${drew.length} draw${drew.length === 1 ? "" : "s"}` : ""}. The other ${behind.length - got} times we were behind at the break, we lost.`,
                    `We've come from behind to win ${times(won.length)}${drew.length ? ` and to draw ${times(drew.length)}` : ""}, from ${behind.length} games behind at half time.`,
                  ])
                : say(c, "cb2", [
                    `We've come from behind to draw ${times(drew.length)} but never to win, from ${behind.length} games behind at the break.`,
                    `We've come from behind ${times(drew.length)}, all draws: ${behind.length} games behind at half time, no wins.`,
                  ]),
          },
    );
  }

  const goalless = level.filter((r) => r.ht_for === 0);
  if (goalless.length >= 2) {
    const stayed = goalless.filter((r) => r.goals_for === 0 && r.goals_against === 0).length;
    if (stayed / goalless.length >= 0.5)
      out.push({
        key: "nilnil",
        heading: "0-0 at the break",
        about: "us",
        strength: clamp(0.25 + stayed * 0.1),
        line: say(c, "nn", [`0-0 at half time ${times(goalless.length)}; ${stayed} of those finished 0-0. When it's tight early, it stays tight.`, `${stayed} of our ${goalless.length} goalless first halves ended goalless.`]),
      });
  }
  return out;
}

function venueHalves(c: Ctx): Finding[] {
  const out: Finding[] = [];
  const atV = c.results.filter((r) => r.venue === c.venue && r.ht_for !== null);
  if (atV.length >= 4) {
    const first = atV.reduce((n, r) => n + (r.ht_for ?? 0), 0);
    const all = atV.reduce((n, r) => n + r.goals_for, 0);
    const share = all ? first / all : 0;
    if (all >= 4 && (share <= 0.25 || share >= 0.65))
      out.push({
        key: "venue-halves",
        heading: `${venueWord(c.venue)}, by half`,
        about: "us",
        strength: clamp(0.35 + Math.abs(share - 0.45) * 1.2),
        line:
          share <= 0.25
            ? say(c, "vh-slow", [
                `${c.venue === "A" ? "Away from home" : "At home"} we've scored ${first} first-half goal${first === 1 ? "" : "s"} in ${atV.length} games, ${all - first} after the break.`,
                `Slow starters ${venueWord(c.venue)}: ${first} of our ${all} goals there came before half time.`,
              ])
            : say(c, "vh-fast", [`${venueWord(c.venue)[0].toUpperCase() + venueWord(c.venue).slice(1)} we do the damage early: ${first} of ${all} goals before the break.`, `Quick out of the blocks ${venueWord(c.venue)}: ${first} first-half goals from ${all}.`]),
      });
  }
  const losses = c.results.filter((r) => r.goals_for < r.goals_against);
  if (losses.length >= 3) {
    const atAway = losses.filter((r) => r.venue === "A").length;
    const one = atAway === losses.length ? "A" : atAway === 0 ? "H" : null;
    if (one)
      out.push({
        key: "defeats",
        heading: "where we lose",
        about: "us",
        strength: clamp(0.4 + losses.length * 0.06 + (one === c.venue ? 0.15 : 0)),
        line: say(c, "def", [
          `All ${losses.length} of our defeats have come ${venueWord(one)}.`,
          `${one === "A" ? "Unbeaten at home" : "Unbeaten away"}; every one of our ${losses.length} defeats was ${venueWord(one)}.`,
        ]),
      });
  }
  const blanks = c.results.filter((r) => r.venue === c.venue && r.goals_for === 0);
  const n = c.results.filter((r) => r.venue === c.venue).length;
  if (n >= 5 && blanks.length >= 3 && blanks.length / n >= 0.3)
    out.push({
      key: "blanks",
      heading: "drawing blanks",
      about: "us",
      strength: clamp(0.3 + blanks.length / n),
      line: say(c, "bl", [`We've failed to score in ${blanks.length} of ${n} games ${venueWord(c.venue)}.`, `${blanks.length} blanks in ${n} ${c.venue === "A" ? "away games" : "home games"}: goals ${venueWord(c.venue)} aren't a given.`]),
    });
  return out;
}

function rest(c: Ctx): Finding[] {
  const sorted = [...c.results].sort((a, b) => a.match_date.localeCompare(b.match_date));
  const gaps = sorted.slice(1).map((r, i) => ({ r, gap: Math.round((Date.parse(r.match_date) - Date.parse(sorted[i].match_date)) / day) }));
  const short = gaps.filter((g) => g.gap <= 3).map((g) => g.r);
  const long = gaps.filter((g) => g.gap >= 4).map((g) => g.r);
  if (short.length < 4 || long.length < 4) return [];
  const a = ppg(short);
  const b = ppg(long);
  const last = sorted.at(-1);
  const restNow = last ? Math.round((Date.parse(c.date) - Date.parse(last.match_date)) / day) : 7;
  if (Math.abs(a - b) < 0.45) return [];
  const worseTired = a < b;
  return [
    {
      key: "rest",
      heading: "days off between",
      about: "us",
      strength: clamp(0.3 + Math.abs(a - b) * 0.35 + (restNow <= 3 ? 0.15 : 0)),
      line: worseTired
        ? say(c, "rest-t", [
            `On three days' rest or less we take ${r2(a)} points a game; with longer, ${r2(b)}.${restNow <= 3 ? ` This one comes ${restNow} days after the last.` : ""}`,
            `The quick turnarounds cost us: ${r2(a)} a game on short rest against ${r2(b)} with a proper week.${restNow <= 3 ? ` Another short one here (${restNow} days).` : ""}`,
          ])
        : say(c, "rest-f", [`We're better on the quick turnaround: ${r2(a)} points a game on three days' rest, ${r2(b)} with longer.`, `Short rest suits us: ${r2(a)} a game with three days or fewer between, ${r2(b)} otherwise.`]),
    },
  ];
}

function strengthBands(c: Ctx, them: Standing | undefined, us: Standing | undefined): Finding[] {
  if (!them || !us || !c.table.length) return [];
  const half = Math.ceil(c.table.length / 2);
  const pos = new Map(c.table.map((s) => [crestKey(s.team), s.position]));
  const league = c.results.filter((r) => pos.has(crestKey(r.opponent)));
  const top = league.filter((r) => pos.get(crestKey(r.opponent))! <= half);
  const bottom = league.filter((r) => pos.get(crestKey(r.opponent))! > half);
  const above = league.filter((r) => pos.get(crestKey(r.opponent))! < us.position);
  const out: Finding[] = [];
  if (top.length >= 3 && bottom.length >= 3) {
    const a = ppg(top);
    const b = ppg(bottom);
    const themTop = them.position <= half;
    const rel = themTop ? top : bottom;
    const gf = rel.reduce((n, r) => n + r.goals_for, 0);
    const ga = rel.reduce((n, r) => n + r.goals_against, 0);
    const w = rel.filter((r) => pts(r) === 3).length;
    const d = rel.filter((r) => pts(r) === 1).length;
    out.push({
      key: "bands",
      heading: themTop ? "against the top half" : "against the bottom half",
      about: "us",
      strength: clamp(0.25 + Math.abs(a - b) * 0.3),
      line: themTop
        ? say(c, "band-t", [
            `Against the top half we're W${w} D${d} L${rel.length - w - d}, ${r2(a)} points a game; against the bottom half, ${r2(b)}.`,
            `The top half is where it gets harder: ${r2(a)} a game there, ${r2(b)} against the rest. Goals ${gf}-${ga} in those ${rel.length}.`,
          ])
        : say(c, "band-b", [
            `Against the bottom half we're W${w} D${d} L${rel.length - w - d}, goals ${gf}-${ga}: ${r2(b)} points a game.`,
            `The sides below halfway: ${r2(b)} points a game, ${gf} scored and ${ga} let in from ${rel.length}.`,
          ]),
    });
  }
  if (above.length >= 3 && them.position < us.position) {
    const w = above.filter((r) => pts(r) === 3).length;
    out.push({
      key: "above",
      heading: "sides above us",
      about: "us",
      strength: clamp(0.25 + (w === 0 ? 0.3 : 0) + Math.abs(ppg(above) - 1.4) * 0.2),
      line: w === 0 ? say(c, "ab0", [`We haven't beaten a side above us in the table yet (${above.length} tries).`, `No wins yet against anyone above us: ${above.length} games.`]) : `Against sides above us: ${w} win${w === 1 ? "" : "s"} from ${above.length}, ${r2(ppg(above))} points a game.`,
    });
  }
  return out;
}

function streaks(c: Ctx): Finding[] {
  const sorted = [...c.results].sort((a, b) => b.match_date.localeCompare(a.match_date));
  const out: Finding[] = [];
  const run = (rs: readonly Result[], test: (r: Result) => boolean) => {
    let n = 0;
    for (const r of rs) {
      if (!test(r)) break;
      n++;
    }
    return n;
  };
  const unbeaten = run(sorted, (r) => pts(r) > 0);
  const winning = run(sorted, (r) => pts(r) === 3);
  const winless = run(sorted, (r) => pts(r) < 3);
  const scoring = run(sorted, (r) => r.goals_for > 0);
  if (winning >= 3) out.push({ key: "run", heading: "the run", about: "us", strength: clamp(0.3 + winning * 0.06), line: say(c, "run-w", [`${winning} wins on the bounce, ${sorted.slice(0, winning).reduce((n, r) => n + r.goals_for, 0)} goals in them.`, `We've won the last ${winning}.`]) });
  else if (unbeaten >= 4) out.push({ key: "run", heading: "the run", about: "us", strength: clamp(0.25 + unbeaten * 0.05), line: `Unbeaten in ${unbeaten}.` });
  else if (winless >= 3) out.push({ key: "run", heading: "the run", about: "us", strength: clamp(0.3 + winless * 0.07), line: say(c, "run-l", [`${winless} without a win.`, `It's ${winless} games since the last win.`]) });
  if (scoring >= 6 && winning < 3) out.push({ key: "scoring-run", heading: "goals", about: "us", strength: clamp(0.2 + scoring * 0.03), line: `We've scored in each of the last ${scoring}.` });
  const atV = sorted.filter((r) => r.venue === c.venue);
  const vUnbeaten = run(atV, (r) => pts(r) > 0);
  const vLosing = run(atV, (r) => pts(r) === 0);
  if (vUnbeaten >= 5) out.push({ key: "venue-run", heading: `${venueWord(c.venue)}, the run`, about: "us", strength: clamp(0.3 + vUnbeaten * 0.04), line: say(c, "vrun", [`Unbeaten in our last ${vUnbeaten} ${c.venue === "H" ? "at home" : "on the road"}.`, `${vUnbeaten} ${c.venue === "H" ? "home" : "away"} games without defeat.`]) });
  else if (vLosing >= 2) out.push({ key: "venue-run", heading: `${venueWord(c.venue)}, the run`, about: "us", strength: clamp(0.3 + vLosing * 0.1), line: `Lost the last ${vLosing} ${c.venue === "H" ? "at home" : "away"}.` });
  return out;
}

function scorers(c: Ctx, them: Standing | undefined): Finding[] {
  const tally = new Map<string, { name: string; goals: number; games: number; home: number; away: number }>();
  for (const r of c.results) {
    const seen = new Set<string>();
    for (const raw of r.scorers ?? []) {
      const s = parseScorer(raw);
      if (!s.key) continue;
      const t = tally.get(s.key) ?? { name: s.name, goals: 0, games: 0, home: 0, away: 0 };
      if (/[A-Z].*[A-Z]/.test(s.name) && !/[A-Z].*[A-Z]/.test(t.name)) t.name = s.name; // prefer "McNally" over "Mcnally"
      t.goals += s.goals;
      if (r.venue === "H") t.home += s.goals;
      else t.away += s.goals;
      if (!seen.has(s.key)) t.games++;
      seen.add(s.key);
      tally.set(s.key, t);
    }
  }
  const list = [...tally.values()].sort((a, b) => b.goals - a.goals);
  if (!list.length) return [];
  const out: Finding[] = [];
  const total = list.reduce((n, s) => n + s.goals, 0);
  const lopsided = list.find((s) => s.goals >= 4 && (c.venue === "A" ? s.away === 0 : s.home === 0));
  const awayMen = list.filter((s) => s.away > 0).sort((a, b) => b.away - a.away);
  if (c.venue === "A" && awayMen.length) {
    const awayGoals = awayMen.reduce((n, s) => n + s.away, 0);
    out.push({
      key: "away-scorers",
      heading: "who scores away",
      about: "us",
      strength: clamp(0.3 + (awayMen[0].away / Math.max(1, awayGoals)) * 0.3),
      line: say(c, "as", [
        `Away goals have come from ${awayMen.slice(0, 3).map((s) => `${s.name} (${s.away})`).join(", ")}: ${awayGoals} in all.`,
        `On the road it's been ${awayMen[0].name} with ${awayMen[0].away} of our ${awayGoals} away goals.`,
      ]),
    });
  }
  if (lopsided)
    out.push({
      key: "lopsided",
      heading: lopsided.name.toLowerCase(),
      about: "us",
      strength: 0.35,
      line: say(c, "lop", [`All ${lopsided.goals} of ${lopsided.name}'s goals have come ${c.venue === "A" ? "at home" : "away"}.`, `${lopsided.name} has ${lopsided.goals} goals, none of them ${venueWord(c.venue)}.`]),
    });
  const top = list[0];
  if (top.goals / total >= 0.25 && top.games >= 4)
    out.push({
      key: "top-scorer",
      heading: "the goals",
      about: "us",
      strength: clamp(0.2 + top.goals / total),
      line: say(c, "ts", [`${top.name} has ${top.goals} of our ${total} goals, scoring in ${top.games} games.`, `${Math.round((top.goals / total) * 100)}% of the goals are ${top.name}'s (${top.goals}).`]),
    });
  else if (list.filter((s) => s.goals > 0).length >= 8)
    out.push({ key: "spread", heading: "the goals", about: "us", strength: 0.25, line: `${list.length} different scorers, nobody past ${top.goals}: the goals are shared round.` });
  void them;
  return out;
}

function margins(c: Ctx): Finding[] {
  const wins = c.results.filter((r) => r.goals_for > r.goals_against);
  const losses = c.results.filter((r) => r.goals_for < r.goals_against);
  const out: Finding[] = [];
  const big = wins.filter((r) => r.goals_for - r.goals_against >= 3);
  if (wins.length >= 5 && big.length / wins.length >= 0.4)
    out.push({ key: "big-wins", heading: "when we win", about: "us", strength: clamp(0.2 + big.length / wins.length / 2), line: say(c, "bw", [`${big.length} of our ${wins.length} wins have been by three or more.`, `When we win it's usually comfortable: ${big.length} of ${wins.length} by three goals or more.`]) });
  const heavy = losses.filter((r) => r.goals_against - r.goals_for >= 3);
  if (heavy.length >= 2)
    out.push({ key: "heavy", heading: "when we lose", about: "us", strength: clamp(0.3 + heavy.length * 0.1), line: say(c, "hv", [`When it goes wrong it goes badly: ${heavy.map((r) => `${score(r)} at ${r.opponent}`).join(", ")}.`, `${heavy.length} defeats by three or more (${heavy.map(score).join(", ")}).`]) });
  return out;
}

function cups(c: Ctx): Finding[] {
  const isLeague = (r: Result) => /counties|league|div(ision)?\s*\d/i.test(r.competition) && !/cup|vase|trophy|challenge/i.test(r.competition);
  const cup = c.results.filter((r) => !isLeague(r));
  const league = c.results.filter(isLeague);
  if (cup.length < 3 || league.length < 5) return [];
  const thisIsCup = !/counties|league/i.test(c.competition) || /cup|vase|trophy|challenge/i.test(c.competition);
  const cw = cup.filter((r) => pts(r) === 3).length;
  const cg = cup.reduce((n, r) => n + r.goals_for, 0) / cup.length;
  const lg = league.reduce((n, r) => n + r.goals_for, 0) / league.length;
  if (Math.abs(ppg(cup) - ppg(league)) < 0.5 && Math.abs(cg - lg) < 1) return [];
  return [
    {
      key: "cups",
      heading: "cups against league",
      about: "us",
      strength: clamp(0.2 + Math.abs(ppg(cup) - ppg(league)) * 0.25 + (thisIsCup ? 0.2 : 0)),
      line: say(c, "cup", [
        `Cup football suits us: W${cw} from ${cup.length}, ${r1(cg)} goals a game against ${r1(lg)} in the league.`,
        `In the cups we're ${cw} from ${cup.length} and scoring ${r1(cg)} a game; the league is ${r2(ppg(league))} points and ${r1(lg)} goals a game.`,
      ]),
    },
  ];
}

/* ── head to head ── */

function headToHead(c: Ctx): Finding[] {
  const key = crestKey(c.opponent);
  const meetings = c.results.filter((r) => crestKey(r.opponent) === key).sort((a, b) => b.match_date.localeCompare(a.match_date));
  if (!meetings.length) return [];
  const last = meetings[0];
  const when = new Date(last.match_date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const ht = last.ht_for !== null && last.ht_against !== null ? ` (${last.ht_for}-${last.ht_against} at half time)` : "";
  const names = (last.scorers ?? []).map((s) => parseScorer(s).name).filter((v, i, a) => a.indexOf(v) === i);
  const who = names.length ? `; ${names.length === 1 ? `${names[0]} got ours` : `${names.slice(0, -1).join(", ")} and ${names.at(-1)} scored`}` : "";
  const res = pts(last) === 3 ? "won" : pts(last) === 1 ? "drew" : "lost";
  const same = last.venue === c.venue;
  const lines = [
    `We ${res} ${score(last)} ${venueWord(last.venue as "H" | "A")} on ${when}${ht}${who}.`,
    `Last time, ${when}: ${score(last)} ${venueWord(last.venue as "H" | "A")}${ht}${names.length ? `. Goals from ${names.join(", ")}` : ""}.`,
  ];
  let extra = "";
  if (meetings.length >= 2) {
    const w = meetings.filter((r) => pts(r) === 3).length;
    const d = meetings.filter((r) => pts(r) === 1).length;
    extra = ` ${meetings.length} meetings this season: W${w} D${d} L${meetings.length - w - d}.`;
  } else if (last.competition !== c.competition) {
    extra = ` That was in the ${last.competition}; this one's the ${c.competition}${same ? ", same ground" : ""}.`;
  } else if (!same) {
    extra = ` This time it's ${venueWord(c.venue)}.`;
  }
  if (last.ht_for !== null && last.ht_for! < last.ht_against! && last.goals_for >= last.goals_against) extra += " We came from behind that day.";
  return [{ key: "h2h", heading: "head to head", about: "h2h", strength: 0.95, line: say(c, "h2h", lines) + extra }];
}

/* ── them ── */

function theirTrajectory(c: Ctx, them: Standing | undefined): Finding[] {
  if (!them) return [];
  const snaps = [...new Set(c.history.map((s) => s.as_of))].sort();
  const mine = snaps.map((d) => c.history.find((s) => s.as_of === d && crestKey(s.team) === crestKey(them.team))).filter(Boolean) as Standing[];
  if (mine.length < 2) return [];
  // the latest window that holds four games or more: two games is noise
  const now = mine.at(-1)!;
  const from = [...mine].reverse().find((s) => now.played - s.played >= 4);
  if (!from) return [];
  const g = now.played - from.played;
  const valid = [{ g, ppg: (now.points - from.points) / g, pos: now.position }];
  const latest = valid.at(-1)!;
  const season = them.played ? them.points / them.played : 0;
  const path = mine.map((s) => ord(s.position)).join(", ");
  const up = latest.ppg! > season + 0.35;
  const down = latest.ppg! < season - 0.35;
  return [
    {
      key: "their-form",
      heading: "their form",
      about: "them",
      strength: clamp(0.3 + Math.abs(latest.ppg! - season) * 0.35),
      line: up
        ? say(c, "tf-up", [
            `On the up: ${ptsA(latest.ppg!)} over their last ${latest.g}, against ${r2(season)} for the season. ${path} across the last tables.`,
            `They've picked up lately, ${r2(latest.ppg!)} a game in the last ${latest.g} (season ${r2(season)}).`,
          ])
        : down
          ? say(c, "tf-dn", [`Going off the boil: ${r2(latest.ppg!)} a game over their last ${latest.g}, down from ${r2(season)} for the season. Table: ${path}.`, `Their form's dipped, ${ptsA(latest.ppg!)} in the last ${latest.g}.`])
          : say(c, "tf-st", [`Steady, ${r2(latest.ppg!)} a game recently and ${r2(season)} across the season. They've gone ${path}.`, `No real swing in their form: ${r2(latest.ppg!)} a game lately, ${r2(season)} overall.`]),
    },
  ];
}

function theirVenue(c: Ctx, them: Standing | undefined): Finding[] {
  if (!them) return [];
  const v = c.venue === "H" ? "away" : "home";
  const other = v === "home" ? "away" : "home";
  const p = (s: Standing, k: "home" | "away") => {
    const x = s[k] ?? {};
    return x.p ? ((x.w ?? 0) * 3 + (x.d ?? 0)) / x.p : null;
  };
  const here = p(them, v);
  const there = p(them, other);
  if (here === null) return [];
  const ranked = [...c.table].filter((s) => p(s, v) !== null).sort((a, b) => p(b, v)! - p(a, v)!);
  const rank = ranked.findIndex((s) => s.team === them.team) + 1;
  const x = them[v] ?? {};
  const gap = there !== null ? here - there : 0;
  const where = v === "home" ? "at home" : "away";
  return [
    {
      key: "their-venue",
      heading: `them ${where}`,
      about: "them",
      strength: clamp(0.3 + Math.abs(gap) * 0.25 + (rank <= 4 || rank > ranked.length - 4 ? 0.2 : 0)),
      line:
        Math.abs(gap) >= 0.6 && there !== null
          ? say(c, "tv-gap", [
              `A different side ${where}: ${r2(here)} points a game there, ${r2(there)} ${v === "home" ? "away" : "at home"}. ${ord(rank)} of ${ranked.length} ${where}.`,
              `${gap < 0 ? "Much weaker" : "Much stronger"} ${where} (${r2(here)} a game, W${x.w ?? 0} D${x.d ?? 0} L${x.l ?? 0}) than ${v === "home" ? "on the road" : "at home"} (${r2(there)}).`,
            ])
          : say(c, "tv", [`W${x.w ?? 0} D${x.d ?? 0} L${x.l ?? 0} ${where}, ${r2(here)} a game: ${ord(rank)} of ${ranked.length} ${where}.`, `${ord(rank)}-best ${where} in the league, ${r2(here)} points a game.`]),
    },
  ];
}

function matchup(c: Ctx, them: Standing | undefined, us: Standing | undefined): Finding[] {
  if (!them || !us) return [];
  const atk = [...c.table].sort((a, b) => b.gf / Math.max(1, b.played) - a.gf / Math.max(1, a.played));
  const def = [...c.table].sort((a, b) => a.ga / Math.max(1, a.played) - b.ga / Math.max(1, b.played));
  const theirAtk = atk.findIndex((s) => s.team === them.team) + 1;
  const ourDef = def.findIndex((s) => s.team === us.team) + 1;
  const ourAtk = atk.findIndex((s) => s.team === us.team) + 1;
  const theirDef = def.findIndex((s) => s.team === them.team) + 1;
  const n = c.table.length;
  const draws = them.played ? them.drawn / them.played : 0;
  const leagueDraws = c.table.reduce((x, s) => x + s.drawn, 0) / Math.max(1, c.table.reduce((x, s) => x + s.played, 0));
  const out: Finding[] = [];
  const leak = n + 1 - theirDef; // 1 = leakiest
  const edge = theirAtk - ourDef + (leak <= n / 2 ? n / 2 - leak : 0) - (ourAtk - 1) / 2;
  // say a rank from whichever end it's nearer: "5th-tightest", never "18th-leakiest"
  const atkW = (r: number) => (r <= n / 2 ? rankWord(r, n, "highest scoring", "lowest scoring") : rankWord(n + 1 - r, n, "lowest scoring", "highest scoring"));
  const defW = (r: number) => (r <= n / 2 ? rankWord(r, n, "tightest", "leakiest") : rankWord(n + 1 - r, n, "leakiest", "tightest"));
  const theirAtkW = atkW(theirAtk);
  const ourAtkW = atkW(ourAtk);
  const ourDefW = defW(ourDef);
  const leakW = defW(theirDef);
  out.push({
    key: "matchup",
    heading: "the match-up",
    about: "them",
    strength: clamp(0.2 + Math.abs(edge) / n * 0.5),
    line:
      theirAtk >= n - 6 && ourDef <= 4
        ? say(c, "mu-a", [
            `Their attack (${theirAtkW}) runs into our defence (${ourDefW}). Goals should be hard for them to come by.`,
            `Blunt against tight: they're ${theirAtkW} in front of goal, we're ${ourDefW} at the back.`,
          ])
        : leak <= 6 && ourAtk <= 8
          ? say(c, "mu-b", [`They let goals in (${leakW}) and we score them (${ourAtkW}).`, `Their defence is ${leakW}; our attack is ${ourAtkW}.`])
          : say(c, "mu-c", [
              `On goals: they're ${theirAtkW} and ${leakW}; we're ${ourAtkW} and ${ourDefW}.`,
              `Their attack is ${theirAtkW} against our ${ourDefW} defence; our attack is ${ourAtkW} against their ${leakW}.`,
            ]),
  });
  if (draws >= leagueDraws + 0.1 && them.played >= 8)
    out.push({
      key: "draws",
      heading: "their draws",
      about: "them",
      strength: clamp(0.3 + (draws - leagueDraws)),
      line: say(c, "dr", [`They draw a lot: ${them.drawn} in ${them.played}, ${Math.round(draws * 100)}% against a league ${Math.round(leagueDraws * 100)}%.`, `${them.drawn} draws from ${them.played}. Hard to beat, not good at winning.`]),
    });
  return out;
}

/** Every pattern that stands out, strongest first, head to head always on top when there is one. */
export function findPatterns(c: Ctx): Finding[] {
  const key = crestKey(c.opponent);
  const them = c.table.find((s) => crestKey(s.team) === key);
  const us = c.table.find((s) => s.is_us);
  const all = [
    ...headToHead(c),
    ...halfTime(c),
    ...venueHalves(c),
    ...rest(c),
    ...strengthBands(c, them, us),
    ...streaks(c),
    ...scorers(c, them),
    ...margins(c),
    ...cups(c),
    ...theirTrajectory(c, them),
    ...theirVenue(c, them),
    ...matchup(c, them, us),
  ].sort((a, b) => b.strength - a.strength);
  // keep a balance: their side of it and ours, eight lines at most
  const theirs = all.filter((f) => f.about === "them").slice(0, 3);
  const ours = all.filter((f) => f.about === "us").slice(0, 5);
  const h2h = all.filter((f) => f.about === "h2h");
  return [...h2h, ...[...theirs, ...ours].sort((a, b) => b.strength - a.strength)].slice(0, 9);
}
