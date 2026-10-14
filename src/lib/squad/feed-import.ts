"use server";

/**
 * Squad from the feed, as actions. The plan is pure (lib/squad/import.ts);
 * this reads the club's own key on the server, writes the new players as the
 * signed-in manager (RLS: manager or coach), and hands near misses back for a
 * person to settle. Numbers are never invented: the feed has none.
 */
import { revalidatePath } from "next/cache";

import { loadAppearances } from "@/lib/league/fwp";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ExternalStats } from "@/lib/types";
import { getViewer, type Viewer } from "@/lib/viewer";

import { planSquadImport, type ImportPlan } from "./import";

export type ImportOutcome =
  | { ok: true; created: number; matched: number; review: ImportPlan["review"]; skipped: ImportPlan["skipped"]; message: string }
  | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const feedStats = (apps: number): ExternalStats => ({ apps, as_of: londonToday(), source: "fwp", position_confirmed: false });

function refuse(viewer: Viewer): string | null {
  if (viewer.guest || viewer.club.is_demo) return "a real club's own manager builds its squad from its own feed";
  if (viewer.role !== "manager") return "only the manager builds the squad from the feed";
  return null;
}

async function runImport(viewer: Viewer): Promise<ImportOutcome> {
  const { data: key } = await createAdminClient().from("club_feed_keys").select("api_key").eq("club_id", viewer.club.id).maybeSingle();
  if (!key || !viewer.club.fwp_team_id) return { ok: false, message: "connect the club's league feed first" };
  let feed;
  try {
    feed = await loadAppearances({ apiKey: key.api_key, teamId: String(viewer.club.fwp_team_id) });
  } catch (e) {
    return { ok: false, message: `Football Web Pages refused the request (${(e as Error).message})` };
  }
  if (!feed.length) return { ok: false, message: "the feed has no appearance list for this team yet" };

  const supabase = await createClient();
  // retired players count: a name that left is not a name to create again
  const { data: squad, error } = await supabase.from("players").select("id, name").eq("club_id", viewer.club.id);
  if (error) return { ok: false, message: error.message };
  const plan = planSquadImport(feed, squad ?? []);

  if (plan.create.length) {
    const { error: insErr } = await supabase.from("players").insert(
      // MF until the manager says: the board asks for every unconfirmed position
      plan.create.map((c) => ({ club_id: viewer.club.id, name: c.name, position: "MF" as const, squad_number: null, external_stats: feedStats(c.apps) })),
    );
    if (insErr) return { ok: false, message: insErr.message };
  }
  revalidatePath("/", "layout");
  const held = plan.review.length ? `, ${plan.review.length} to check by hand` : "";
  return {
    ok: true,
    created: plan.create.length,
    matched: plan.matched.length,
    review: plan.review,
    skipped: plan.skipped,
    message: `${plan.create.length} added from the feed, ${plan.matched.length} already in the squad${held}. Numbers are not in the feed: add them in the squad room.`,
  };
}

export async function importSquadFromFeedAction(): Promise<ImportOutcome> {
  const viewer = await getViewer();
  const no = refuse(viewer);
  if (no) return { ok: false, message: no };
  return runImport(viewer);
}

/** Settle a name the import held back: the same player as one already here, or a new one. */
export async function resolveImportAction(input: { feedName: string; apps: number; samePlayerId: string | null }): Promise<{ ok: boolean; message: string }> {
  const viewer = await getViewer();
  const no = refuse(viewer);
  if (no) return { ok: false, message: no };
  const name = String(input.feedName ?? "").replace(/\s+/g, " ").trim();
  const apps = Number(input.apps);
  if (name.length < 2 || name.length > 60) return { ok: false, message: "that name is not right" };
  if (!Number.isInteger(apps) || apps < 0 || apps > 200) return { ok: false, message: "appearances are a whole number" };
  const supabase = await createClient();
  if (input.samePlayerId) {
    if (!UUID.test(input.samePlayerId)) return { ok: false, message: "no such player" };
    const { data: p } = await supabase.from("players").select("name, external_stats").eq("id", input.samePlayerId).eq("club_id", viewer.club.id).maybeSingle();
    if (!p) return { ok: false, message: "no such player" };
    // the feed's numbers only; the name and position stay as the manager has them
    const stats = { ...((p.external_stats as ExternalStats | null) ?? {}), apps, as_of: londonToday(), source: "fwp" };
    const { error } = await supabase.from("players").update({ external_stats: stats }).eq("id", input.samePlayerId).eq("club_id", viewer.club.id);
    if (error) return { ok: false, message: error.message };
    revalidatePath("/", "layout");
    return { ok: true, message: `${name} is ${p.name}` };
  }
  const { error } = await supabase.from("players").insert({ club_id: viewer.club.id, name, position: "MF", squad_number: null, external_stats: feedStats(apps) });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  return { ok: true, message: `${name} added` };
}
