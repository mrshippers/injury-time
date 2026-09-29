"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { CheckinAvailable } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Staff fetch a player's private check-in link to send him (WhatsApp, text).
 * The token table has no API policies: the link comes only through here, after
 * the role check, and never for a demo club.
 */
export async function checkinLinkAction(playerId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (viewer.guest || viewer.club.is_demo) return { ok: false, error: "check-ins are for a real club's own players, never a public demo" };
  if (!viewer.can("view_squad_health")) return { ok: false, error: "only staff send check-in links" };
  if (!UUID.test(playerId)) return { ok: false, error: "unknown player" };

  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("id, club_id, retired_on").eq("id", playerId).maybeSingle();
  if (!player || player.club_id !== viewer.club.id || player.retired_on) return { ok: false, error: "that player is not in this squad" };

  let { data: link } = await admin.from("player_checkin_links").select("token").eq("player_id", playerId).maybeSingle();
  if (!link) {
    const ins = await admin.from("player_checkin_links").insert({ player_id: playerId }).select("token").single();
    if (ins.error) return { ok: false, error: ins.error.message };
    link = ins.data;
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "injury-time.vercel.app";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return { ok: true, url: `${proto}://${host}/checkin/${link.token}` };
}

export type CheckinState = { ok: boolean; message: string } | null;

/** The player's own submit. No account: the token is the credential, the database checks everything. */
export async function submitCheckinAction(input: {
  token: string;
  consent: boolean;
  soreness: number;
  lastRpe: number | null;
  available: CheckinAvailable;
}): Promise<CheckinState> {
  if (!UUID.test(input.token)) return { ok: false, message: "this link is not recognised" };
  if (!Number.isInteger(input.soreness) || input.soreness < 0 || input.soreness > 10) return { ok: false, message: "pick how sore, 0 to 10" };
  if (input.lastRpe !== null && (!Number.isInteger(input.lastRpe) || input.lastRpe < 1 || input.lastRpe > 10)) return { ok: false, message: "pick how hard, 1 to 10" };
  if (!["yes", "no", "unsure"].includes(input.available)) return { ok: false, message: "are you available?" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_checkin", {
    token: input.token,
    consent: input.consent === true,
    soreness: input.soreness,
    last_rpe: input.lastRpe,
    available: input.available,
  });
  if (error) return { ok: false, message: "could not save, try again" };
  if (data === "consent_required") return { ok: false, message: "tick the box to agree first" };
  if (data !== "ok") return { ok: false, message: "this link is not recognised" };
  revalidatePath(`/checkin/${input.token}`);
  return { ok: true, message: "done. You can change today's answers until midnight." };
}

export async function withdrawCheckinsAction(token: string): Promise<CheckinState> {
  if (!UUID.test(token)) return { ok: false, message: "this link is not recognised" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("withdraw_checkins", { token });
  if (error || data !== "withdrawn") return { ok: false, message: "could not withdraw, try again" };
  revalidatePath(`/checkin/${token}`);
  return { ok: true, message: "withdrawn. Every check-in you sent is deleted and the club sees nothing from you." };
}
