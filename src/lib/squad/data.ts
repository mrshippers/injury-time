/**
 * Reads for the squad room that the shared data boundary does not cover:
 * the side saved for a fixture. Server-side only.
 */
import { createClient } from "@/lib/supabase/server";
import type { CallStatus, SavedLineup } from "@/lib/types";

export async function getSavedLineup(clubId: string, fixtureId: string | null): Promise<SavedLineup | null> {
  if (!fixtureId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lineups")
    .select("*")
    .eq("club_id", clubId)
    .eq("fixture_id", fixtureId)
    .maybeSingle();
  if (error) throw error;
  return (data as SavedLineup | null) ?? null;
}

/** The side named most recently for any other match: tomorrow's default if nobody has picked yet. */
export async function getPreviousLineup(clubId: string, exceptFixtureId: string | null): Promise<SavedLineup | null> {
  const supabase = await createClient();
  let q = supabase.from("lineups").select("*").eq("club_id", clubId).order("updated_at", { ascending: false }).limit(1);
  if (exceptFixtureId) q = q.neq("fixture_id", exceptFixtureId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? [])[0] as SavedLineup | undefined) ?? null;
}

/** Who has answered for this match, by player: the picker leaves out anyone who said out. */
export async function getCallsByPlayer(fixtureId: string | null): Promise<Record<string, CallStatus>> {
  if (!fixtureId) return {};
  const supabase = await createClient();
  const { data, error } = await supabase.from("match_calls").select("player_id, status").eq("fixture_id", fixtureId);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((c) => [c.player_id as string, c.status as CallStatus]));
}
