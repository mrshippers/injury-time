"use server";

/**
 * The No.2's server actions. Each one builds its facts from the database on the server (never trusts the
 * client for numbers), checks for words already written for the same thing, and only then asks Claude.
 */
import { getHomeSeason } from "@/lib/home/data";
import { todayISO } from "@/lib/data";
import { BRIEF_SYSTEM, BriefSchema, briefPrompt, scoutFacts, type Brief } from "@/lib/scout/brief";
import { createClient } from "@/lib/supabase/server";
import type { Fixture } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

import { askStructured } from "./claude";
import { AnswerSchema, NudgeSchema, ReportSchema, type MatchReport, type No2Answer } from "./schemas";
import { getNote, putNote } from "./notes";

export type ActionOutcome<T> = { ok: true; value: T } | { ok: false; error: string };

export async function writeBriefAction(fixtureId: string): Promise<ActionOutcome<Brief>> {
  const viewer = await getViewer();
  const existing = await getNote<Brief>(viewer.club.id, "brief", fixtureId);
  if (existing) return { ok: true, value: existing.body };
  const supabase = await createClient();
  const { data: fx } = await supabase.from("fixtures").select("*").eq("id", fixtureId).eq("club_id", viewer.club.id).maybeSingle();
  if (!fx) return { ok: false, error: "that match isn't in the diary" };
  const season = await getHomeSeason(viewer.club.id, todayISO());
  const facts = scoutFacts(fx as Fixture, season.standings, season.results);
  if (!facts) return { ok: false, error: "they aren't in our league table, so there's nothing to model" };
  const res = await askStructured({ system: BRIEF_SYSTEM, user: briefPrompt(viewer.club.name, facts), schema: BriefSchema, effort: "medium" });
  if (!res.ok) return res;
  await putNote(viewer.club.id, "brief", fixtureId, res.value, res.model);
  return { ok: true, value: res.value };
}

/* ── match report ── */


const REPORT_SYSTEM = `You write match reports for an English non-league club's website and socials, the way the club's own media volunteer would: warm, specific, proud, never hype.

Rules:
- Use only the facts given (score, half-time score, scorers, competition, venue, crowd, what it means in the table or the cup). Never invent moments, minutes, assists or quotes.
- Scorers: "(2)" means a brace, "pen" a penalty, "og" an own goal by the opposition.
- British English, no em dashes, no hashtags unless it's the club name.`;

export async function writeReportAction(resultId: string): Promise<ActionOutcome<MatchReport>> {
  const viewer = await getViewer();
  const existing = await getNote<MatchReport>(viewer.club.id, "report", resultId);
  if (existing) return { ok: true, value: existing.body };
  const supabase = await createClient();
  const { data: r } = await supabase.from("results").select("*").eq("id", resultId).eq("club_id", viewer.club.id).maybeSingle();
  if (!r) return { ok: false, error: "that result isn't on the books" };
  const season = await getHomeSeason(viewer.club.id, todayISO());
  const us = season.standings.find((s) => s.is_us);
  const res = await askStructured({
    system: REPORT_SYSTEM,
    schema: ReportSchema,
    effort: "low",
    user: `Club: ${viewer.club.name}.
Result: ${viewer.club.name} ${r.goals_for}-${r.goals_against} ${r.opponent} (${r.venue === "H" ? "home" : "away"}), ${r.competition}, ${r.match_date}.
Half time: ${r.ht_for ?? "?"}-${r.ht_against ?? "?"}. Crowd: ${r.attendance ?? "not recorded"}.
Our scorers: ${(r.scorers as string[] | null)?.join(", ") || "none recorded"}.
League position now: ${us ? `${us.position}th, ${us.points} pts from ${us.played}` : "unknown"}.
Write the report.`,
  });
  if (!res.ok) return res;
  await putNote(viewer.club.id, "report", resultId, res.value, res.model);
  return { ok: true, value: res.value };
}

/* ── the No.2: questions about the season ── */

const ANSWER_SYSTEM = `You are the No.2 (assistant manager) at an English non-league club. The gaffer asks you about the season and you answer from the club's results and the league table, which are given in full.

Rules:
- Count from the data; never estimate or invent. If the data can't answer it (minutes of goals, individual minutes played, opposition players), set can_answer false and say what would be needed.
- Lead with the answer, then the numbers behind it. British English, no em dashes, no jargon.`;

export async function askNo2Action(question: string): Promise<ActionOutcome<No2Answer>> {
  const q = question.trim().slice(0, 300);
  if (q.length < 4) return { ok: false, error: "ask a proper question, gaffer" };
  const viewer = await getViewer();
  const key = q.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ");
  const existing = await getNote<No2Answer>(viewer.club.id, "answer", key);
  if (existing) return { ok: true, value: existing.body };
  const season = await getHomeSeason(viewer.club.id, todayISO());
  const results = season.results
    .map((r) => `${r.match_date} | ${r.competition} | ${r.venue} | ${r.opponent} | ${r.goals_for}-${r.goals_against} | ht ${r.ht_for ?? "?"}-${r.ht_against ?? "?"} | crowd ${r.attendance ?? "?"} | ${(r.scorers ?? []).join("; ")}`)
    .join("\n");
  const table = season.standings.map((t) => `${t.position} ${t.team}${t.is_us ? " (US)" : ""}: P${t.played} W${t.won} D${t.drawn} L${t.lost} ${t.gf}-${t.ga} ${t.points}pts`).join("\n");
  const res = await askStructured({
    system: ANSWER_SYSTEM,
    schema: AnswerSchema,
    effort: "medium",
    user: `Club: ${viewer.club.name}.\n\nResults this season (date | competition | venue | opponent | score | half time | crowd | our scorers):\n${results}\n\nLeague table:\n${table}\n\nThe gaffer asks: ${q}`,
  });
  if (!res.ok) return res;
  await putNote(viewer.club.id, "answer", key, res.value, res.model);
  return { ok: true, value: res.value };
}

/* ── nudge the quiet ones ── */

const NUDGE_SYSTEM = `You write the message a non-league manager drops in the team group chat to chase players who haven't said if they're available. Sound like the gaffer: short, direct, a bit of banter, never nasty, no corporate tone. Name the players. British English, no em dashes, at most one emoji.`;

export async function writeNudgeAction(fixtureId: string, names: string[]): Promise<ActionOutcome<{ message: string }>> {
  const viewer = await getViewer();
  const clean = names.map((n) => n.replace(/[^\p{L} '-]/gu, "").slice(0, 40)).filter(Boolean).slice(0, 30);
  if (clean.length === 0) return { ok: false, error: "everyone's answered" };
  const supabase = await createClient();
  const { data: fx } = await supabase.from("fixtures").select("opponent, venue, match_date, kickoff, calls_close_at").eq("id", fixtureId).eq("club_id", viewer.club.id).maybeSingle();
  if (!fx) return { ok: false, error: "that match isn't in the diary" };
  const res = await askStructured({
    system: NUDGE_SYSTEM,
    schema: NudgeSchema,
    effort: "low",
    maxTokens: 1000,
    user: `Match: ${fx.venue === "H" ? "home to" : "away at"} ${fx.opponent}, ${fx.match_date}${fx.kickoff ? ` ${fx.kickoff}` : ""}.${fx.calls_close_at ? ` Answers close ${fx.calls_close_at}.` : ""}
Not answered yet: ${clean.join(", ")}.
Write the message.`,
  });
  if (!res.ok) return res;
  return { ok: true, value: res.value };
}
