import { syncClubFeed } from "@/lib/club/sync";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Nightly: every club that connected its own Football Web Pages key gets its
 * season pulled with THAT key. Injury Time holds no key of its own.
 *
 * Endings: done (every club synced), nothing-to-do (no club has a key yet),
 * DEGRADED (any club failed, named). A failed sync is written to that club's
 * key row so the club page shows it, and the club keeps its last good season.
 * At most ten requests a minute per key upstream: three per club, one club at a time.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorised" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: keys, error } = await admin.from("club_feed_keys").select("club_id, api_key");
  if (error) return Response.json({ status: "degraded", reason: `keys: ${error.message}` }, { status: 503 });
  if (!keys?.length) return Response.json({ status: "nothing-to-do", reason: "no club has connected a key" });

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
  const failed: string[] = [];
  const synced: string[] = [];
  for (const k of keys) {
    const { data: club } = await admin.from("clubs").select("id, name, slug, fwp_team_id").eq("id", k.club_id).maybeSingle();
    if (!club?.fwp_team_id) {
      failed.push(`${k.club_id}: no team id`);
      continue;
    }
    const outcome = await syncClubFeed(admin, club, { apiKey: k.api_key, teamId: String(club.fwp_team_id) }, today);
    const note = outcome.ok ? `synced ${outcome.report.results} results` : outcome.reason;
    await admin.from("club_feed_keys").update({ last_sync_at: new Date().toISOString(), last_sync_note: note }).eq("club_id", k.club_id);
    (outcome.ok ? synced : failed).push(`${club.name}: ${note}`);
  }

  if (failed.length) return Response.json({ status: "degraded", failed, synced }, { status: 503 });
  return Response.json({ status: "done", synced });
}
