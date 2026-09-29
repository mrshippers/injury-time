/**
 * Sync one club's season from its OWN Football Web Pages key. Shared by the
 * "save key" action (so a pasted key is proven before it is kept) and the
 * nightly cron. The service-role client is the caller's, never created here.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { refreshSeason, type RefreshReport } from "@/lib/league";
import { loadFromFwp } from "@/lib/league/fwp";
import type { Club, Database } from "@/lib/types";

type Admin = SupabaseClient<Database>;

export type SyncOutcome = { ok: true; report: RefreshReport } | { ok: false; reason: string };

export async function syncClubFeed(
  admin: Admin,
  club: Pick<Club, "id" | "name" | "slug">,
  cfg: { apiKey: string; teamId: string },
  today: string,
  fetchImpl?: typeof fetch,
): Promise<SyncOutcome> {
  let data;
  try {
    data = await loadFromFwp({ ...cfg, fetchImpl }, club.name, today);
  } catch (e) {
    return { ok: false, reason: `Football Web Pages refused the request (${(e as Error).message})` };
  }
  if (data.results.length + data.fixtures.length === 0) {
    return { ok: false, reason: `the key works, but team ${cfg.teamId} has no fixtures or results under the name "${club.name}"` };
  }
  let report: RefreshReport;
  try {
    report = await refreshSeason(admin, club, { source: "fwp", data }, today);
  } catch (e) {
    return { ok: false, reason: `the season could not be written (${(e as Error).message})` };
  }
  const now = new Date().toISOString();
  await admin.from("clubs").update({ season_source: "feed", season_synced_at: now }).eq("id", club.id);
  return { ok: true, report };
}
