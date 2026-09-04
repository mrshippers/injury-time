"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getSquadBoard } from "@/lib/data";
import { getViewer } from "@/lib/viewer";
import { CLIP_EVENT_KINDS, type ClipAnalysis, type ClipEvent, type ClipEventKind } from "@/lib/types";

import { analyseFilm } from "./analyse";
import { gameForClip, getClip, insertClip, listSquad, saveAnalysis, saveEvents } from "./data";
import { parseFilmUrl } from "./urls";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_EVENTS = 200;

export type AddFilmResult = { ok: false; error: string };

/**
 * Add a piece of film. A native form post, so every field is re-checked here:
 * a Server Action is reachable by anyone who can reach the page.
 */
export async function addFilmAction(_prev: AddFilmResult | null, form: FormData): Promise<AddFilmResult> {
  const viewer = await getViewer();
  if (!viewer.can("manage_film")) return { ok: false, error: "only staff can add film" };

  const url = String(form.get("url") ?? "").trim();
  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const matchDate = String(form.get("match_date") ?? "").trim();
  const fixtureId = String(form.get("fixture_id") ?? "").trim();
  const opponent = String(form.get("opponent") ?? "").trim().slice(0, 80);

  const parsed = parseFilmUrl(url);
  if (!parsed) return { ok: false, error: "that link is not a Veo or YouTube link we can read" };
  if (!title) return { ok: false, error: "give the film a title" };
  if (matchDate && !ISO_DATE.test(matchDate)) return { ok: false, error: "match date must be a date" };

  const id = await insertClip({
    clubId: viewer.club.id,
    source: parsed.source,
    url: parsed.canonical,
    title,
    matchDate: matchDate || null,
    fixtureId: fixtureId || null,
    opponent: opponent || null,
    createdBy: viewer.userId,
  });
  revalidatePath("/film");
  redirect(`/film/${id}`);
}

function cleanEvent(raw: unknown): ClipEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const t = Number(e.t);
  if (!Number.isFinite(t) || t < 0 || t > 6 * 3600) return null;
  const kind = String(e.kind ?? "");
  if (!(CLIP_EVENT_KINDS as readonly string[]).includes(kind)) return null;
  const out: ClipEvent = { t: Math.round(t), kind: kind as ClipEventKind };
  if (typeof e.player_id === "string" && e.player_id) out.player_id = e.player_id;
  if (typeof e.note === "string" && e.note.trim()) out.note = e.note.trim().slice(0, 240);
  return out;
}

export async function saveEventsAction(clipId: string, events: unknown[]): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer.can("manage_film")) return { ok: false, error: "only staff can tag film" };
  if (typeof clipId !== "string" || !clipId) return { ok: false, error: "no clip" };
  if (!Array.isArray(events) || events.length > MAX_EVENTS) return { ok: false, error: "too many events" };
  const clean = events.map(cleanEvent).filter((e): e is ClipEvent => e !== null).sort((a, b) => a.t - b.t);
  const squad = await listSquad(viewer.club.id);
  const ids = new Set(squad.map((p) => p.id));
  for (const e of clean) if (e.player_id && !ids.has(e.player_id)) delete e.player_id;
  await saveEvents(viewer.club.id, clipId, clean);
  revalidatePath(`/film/${clipId}`);
  revalidatePath("/film");
  return { ok: true };
}

export type AnalyseResult = { ok: true; analysis: ClipAnalysis } | { ok: false; error: string };

export async function analyseClipAction(clipId: string): Promise<AnalyseResult> {
  const viewer = await getViewer();
  if (!viewer.can("manage_film")) return { ok: false, error: "only staff can run analysis" };
  const clip = await getClip(viewer.club.id, clipId);
  if (!clip) return { ok: false, error: "clip not found" };

  const [{ result, fixture }, squad] = await Promise.all([gameForClip(viewer.club.id, clip), listSquad(viewer.club.id)]);

  // readiness words, only when the board is this club's
  const readiness: Record<string, string> = {};
  try {
    const board = await getSquadBoard();
    if (board.club.id === viewer.club.id) {
      for (const row of board.rows) if (row.readiness.key !== "unknown") readiness[row.player.id] = row.readiness.word;
    }
  } catch {
    // no board, no readiness: the analysis still runs
  }

  const outcome = await analyseFilm({
    club: { name: viewer.club.name, league: viewer.club.league, division: viewer.club.division },
    clip: { title: clip.title, source: clip.source, matchDate: clip.match_date, opponent: clip.opponent ?? fixture?.opponent ?? result?.opponent ?? null },
    result: result
      ? { venue: result.venue, goalsFor: result.goals_for, goalsAgainst: result.goals_against, competition: result.competition }
      : null,
    fixture: fixture ? { venue: fixture.venue, matchDate: fixture.match_date, competition: fixture.competition, opponent: fixture.opponent } : null,
    events: clip.events,
    players: squad.map((p) => ({ id: p.id, name: p.name, position: p.position, squad_number: p.squad_number })),
    readiness,
  });
  if (!outcome.ok) return outcome;
  await saveAnalysis(viewer.club.id, clipId, outcome.analysis);
  revalidatePath(`/film/${clipId}`);
  revalidatePath("/film");
  return outcome;
}
