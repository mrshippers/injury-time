"use server";

import { revalidatePath } from "next/cache";

import { progressFrom } from "@/lib/league";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

import { parseResultInput, type ResultInput } from "./result-input";
import { syncClubFeed } from "./sync";

export type ActionState = { ok: boolean; message: string } | null;

const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());

/**
 * Save the club's own Football Web Pages key. Only a signed-in manager of a
 * real club: a guest on a demo club is refused, and the key is proven by a real
 * sync before it is kept, so a typo never sits there failing silently every night.
 */
export async function saveFeedKeyAction(input: { apiKey: string; teamId: string }): Promise<ActionState> {
  const viewer = await getViewer();
  if (viewer.guest || viewer.club.is_demo) return { ok: false, message: "only a signed-in manager of a real club can connect its league feed" };
  if (viewer.role !== "manager") return { ok: false, message: "only the club's manager can connect the league feed" };

  const apiKey = String(input.apiKey ?? "").trim();
  const teamId = String(input.teamId ?? "").trim();
  if (apiKey.length < 8 || apiKey.length > 200 || /\s/.test(apiKey)) return { ok: false, message: "that does not look like a Football Web Pages key" };
  if (!/^\d{1,9}$/.test(teamId)) return { ok: false, message: "the team id is the number in your club's Football Web Pages address" };

  const admin = createAdminClient();
  const outcome = await syncClubFeed(admin, viewer.club, { apiKey, teamId }, londonToday());
  if (!outcome.ok) return { ok: false, message: `not saved: ${outcome.reason}` };

  const now = new Date().toISOString();
  const { error } = await admin.from("club_feed_keys").upsert(
    { club_id: viewer.club.id, provider: "fwp", api_key: apiKey, last_sync_at: now, last_sync_note: "connected", updated_at: now }
  );
  if (error) return { ok: false, message: `the season synced but the key could not be kept (${error.message})` };
  await admin.from("clubs").update({ fwp_team_id: Number(teamId) }).eq("id", viewer.club.id);

  revalidatePath("/", "layout");
  const r = outcome.report;
  return { ok: true, message: `connected: ${r.results} results, ${r.fixturesAdded} new fixtures, table of ${r.standings}` };
}

export async function removeFeedKeyAction(): Promise<ActionState> {
  const viewer = await getViewer();
  if (viewer.guest || viewer.club.is_demo || viewer.role !== "manager") return { ok: false, message: "only the club's manager can disconnect the feed" };
  const admin = createAdminClient();
  const { error } = await admin.from("club_feed_keys").delete().eq("club_id", viewer.club.id);
  if (error) return { ok: false, message: error.message };
  await admin.from("clubs").update({ season_source: "manual" }).eq("id", viewer.club.id);
  revalidatePath("/", "layout");
  return { ok: true, message: "disconnected; the key is deleted and results are yours to enter" };
}

/**
 * Enter a result by hand. Staff of any club; on the demo clubs only the
 * fictional one, because a guest typing a score for a real club is inventing
 * facts about real people.
 */
export async function addResultAction(input: ResultInput): Promise<ActionState> {
  const viewer = await getViewer();
  if (viewer.guest && viewer.club.season_source !== "manual") {
    return { ok: false, message: `${viewer.club.name} is a real club shown from its public data; results are not typed in here` };
  }
  if (!viewer.guest && viewer.role !== "manager" && viewer.role !== "coach") return { ok: false, message: "only the manager or a coach enters results" };

  const parsed = parseResultInput(input, londonToday());
  if (!parsed.ok) return { ok: false, message: parsed.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("results")
    .upsert({ ...parsed.result, club_id: viewer.club.id }, { onConflict: "club_id,match_date,opponent" });
  if (error) return { ok: false, message: error.message };

  // the points line is derived from the results, so rebuild it
  const { data: all, error: rErr } = await supabase.from("results").select("*").eq("club_id", viewer.club.id);
  if (rErr) return { ok: false, message: rErr.message };
  const progress = progressFrom(all ?? [], null);
  if (progress.length) {
    const { error: pErr } = await supabase
      .from("league_progress")
      .upsert(progress.map((p) => ({ ...p, club_id: viewer.club.id })), { onConflict: "club_id,match_no" });
    if (pErr) return { ok: false, message: pErr.message };
  }

  revalidatePath("/", "layout");
  const r = parsed.result;
  return { ok: true, message: `saved: ${r.goals_for}-${r.goals_against} ${r.venue === "H" ? "v" : "at"} ${r.opponent}` };
}
