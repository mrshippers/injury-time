/**
 * Reads and writes for the film room. Server-side only. The tables came in
 * with migration 0008 and are not yet in the generated Database type, so the
 * client is loosened here, in one place, until the types catch up.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { Clip, ClipAnalysis, ClipEvent, ClipSource, Fixture, Player, Result } from "@/lib/types";

async function db(): Promise<SupabaseClient> {
  const supabase = await createClient();
  return supabase as unknown as SupabaseClient;
}

export async function listClips(clubId: string): Promise<Clip[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("clips")
    .select("*")
    .eq("club_id", clubId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Clip[];
}

export async function getClip(clubId: string, id: string): Promise<Clip | null> {
  const supabase = await db();
  const { data, error } = await supabase.from("clips").select("*").eq("club_id", clubId).eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Clip | null) ?? null;
}

/** Fixtures still to come and results already in, for the attach picker. */
export async function listGames(clubId: string): Promise<{ fixtures: Fixture[]; results: Result[] }> {
  const supabase = await db();
  const [f, r] = await Promise.all([
    supabase.from("fixtures").select("*").eq("club_id", clubId).order("match_date", { ascending: true }),
    supabase.from("results").select("*").eq("club_id", clubId).order("match_date", { ascending: false }),
  ]);
  if (f.error) throw f.error;
  if (r.error) throw r.error;
  return { fixtures: (f.data ?? []) as Fixture[], results: (r.data ?? []) as Result[] };
}

export async function listSquad(clubId: string): Promise<Player[]> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .eq("club_id", clubId)
    .is("retired_on", null)
    .order("squad_number", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Player[];
}

export async function insertClip(input: {
  clubId: string;
  source: ClipSource;
  url: string;
  title: string;
  matchDate: string | null;
  fixtureId: string | null;
  opponent: string | null;
  createdBy: string | null;
}): Promise<string> {
  const supabase = await db();
  const { data, error } = await supabase
    .from("clips")
    .insert({
      club_id: input.clubId,
      source: input.source,
      url: input.url,
      title: input.title,
      match_date: input.matchDate,
      fixture_id: input.fixtureId,
      opponent: input.opponent,
      created_by: input.createdBy,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function saveEvents(clubId: string, id: string, events: ClipEvent[]): Promise<void> {
  const supabase = await db();
  const { error } = await supabase
    .from("clips")
    .update({ events, status: events.length > 0 ? "tagged" : "new" })
    .eq("club_id", clubId)
    .eq("id", id);
  if (error) throw error;
}

export async function saveAnalysis(clubId: string, id: string, analysis: ClipAnalysis): Promise<void> {
  const supabase = await db();
  const { error } = await supabase
    .from("clips")
    .update({ analysis, status: "analysed" })
    .eq("club_id", clubId)
    .eq("id", id);
  if (error) throw error;
}

/** The game a clip is about: a result if we have one, else the fixture it is attached to. */
export async function gameForClip(clubId: string, clip: Clip): Promise<{ result: Result | null; fixture: Fixture | null }> {
  const supabase = await db();
  let fixture: Fixture | null = null;
  if (clip.fixture_id) {
    const { data } = await supabase.from("fixtures").select("*").eq("id", clip.fixture_id).maybeSingle();
    fixture = (data as Fixture | null) ?? null;
  }
  let result: Result | null = null;
  if (clip.match_date && clip.opponent) {
    const { data } = await supabase
      .from("results")
      .select("*")
      .eq("club_id", clubId)
      .eq("match_date", clip.match_date)
      .eq("opponent", clip.opponent)
      .maybeSingle();
    result = (data as Result | null) ?? null;
  }
  return { result, fixture };
}
