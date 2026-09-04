/**
 * Reads for the squad room that the shared data boundary does not cover:
 * the side saved for a fixture. Server-side only.
 */
import { createClient } from "@/lib/supabase/server";
import type { SavedLineup } from "@/lib/types";

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
