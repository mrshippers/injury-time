"use server";

/**
 * Consent, notes and erasure (0014). The database decides every rule; these
 * actions check the obvious first so a refusal reads as a sentence.
 */
import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site-url";
import { getViewer } from "@/lib/viewer";

import { CONSENT_VERSION, consentError } from "./consent";

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Staff: the player's private consent link, to send them. Same credential as the check-in link (0009). */
export async function consentLinkAction(playerId: string): Promise<Res<{ url: string }>> {
  const viewer = await getViewer();
  if (viewer.guest || viewer.club.is_demo) return { ok: false, error: "consent is for a real club's own players" };
  if (!viewer.can("view_squad_health")) return { ok: false, error: "only staff send consent links" };
  if (!UUID.test(playerId)) return { ok: false, error: "unknown player" };
  const admin = createAdminClient();
  const { data: player } = await admin.from("players").select("club_id, retired_on").eq("id", playerId).maybeSingle();
  if (!player || player.club_id !== viewer.club.id || player.retired_on) return { ok: false, error: "that player is not in this squad" };
  let { data: link } = await admin.from("player_checkin_links").select("token").eq("player_id", playerId).maybeSingle();
  if (!link) {
    const ins = await admin.from("player_checkin_links").insert({ player_id: playerId }).select("token").single();
    if (ins.error) return { ok: false, error: ins.error.message };
    link = ins.data;
  }
  return { ok: true, url: await siteUrl(`/consent/${link.token}`) };
}

/** The player, from their private link. */
export async function giveConsentByLinkAction(token: string, dob: string): Promise<Res> {
  if (!UUID.test(token)) return { ok: false, error: "this link is not recognised" };
  if (!ISO.test(dob)) return { ok: false, error: "your date of birth, please" };
  const { data, error } = await (await createClient()).rpc("give_health_consent_by_link", { token, dob, wording: CONSENT_VERSION });
  if (error) return { ok: false, error: consentError(error.message) };
  if (data === "unknown_link") return { ok: false, error: "this link is not recognised" };
  return { ok: true };
}

/** The player, signed in, on their own page. */
export async function giveConsentAction(playerId: string, dob: string): Promise<Res> {
  if (!UUID.test(playerId)) return { ok: false, error: "unknown player" };
  if (!ISO.test(dob)) return { ok: false, error: "your date of birth, please" };
  const { error } = await (await createClient()).rpc("give_health_consent", { pid: playerId, dob, wording: CONSENT_VERSION });
  if (error) return { ok: false, error: consentError(error.message) };
  revalidatePath(`/player/${playerId}`, "layout");
  return { ok: true };
}

export async function withdrawConsentAction(playerId: string): Promise<Res> {
  if (!UUID.test(playerId)) return { ok: false, error: "unknown player" };
  const { error } = await (await createClient()).rpc("withdraw_health_consent", { pid: playerId });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/player/${playerId}`, "layout");
  return { ok: true };
}

/** Delete every health row about the player: the player, or the manager or medical on their request. */
export async function eraseHealthAction(playerId: string): Promise<Res<{ removed: number }>> {
  if (!UUID.test(playerId)) return { ok: false, error: "unknown player" };
  const { data, error } = await (await createClient()).rpc("erase_player_health", { pid: playerId });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, removed: Object.values(data ?? {}).reduce((a, b) => a + Number(b), 0) };
}

export async function eraseHealthByLinkAction(token: string): Promise<Res<{ removed: number }>> {
  if (!UUID.test(token)) return { ok: false, error: "this link is not recognised" };
  const { data, error } = await (await createClient()).rpc("erase_player_health_by_link", { token });
  if (error) return { ok: false, error: error.message };
  return { ok: true, removed: Object.values(data ?? {}).reduce((a, b) => a + Number(b), 0) };
}

/** Medical only (RLS); short, about one player, maybe one injury. */
export async function addMedicalNoteAction(input: { playerId: string; injuryId?: string | null; body: string }): Promise<Res> {
  const viewer = await getViewer();
  if (viewer.guest || viewer.role !== "medical") return { ok: false, error: "only medical staff write notes" };
  if (!UUID.test(input?.playerId ?? "")) return { ok: false, error: "unknown player" };
  const body = String(input.body ?? "").trim();
  if (body.length < 1 || body.length > 280) return { ok: false, error: "a note is 1 to 280 characters" };
  const injuryId = input.injuryId && UUID.test(input.injuryId) ? input.injuryId : null;
  const { error } = await (await createClient())
    .from("medical_notes")
    .insert({ club_id: viewer.club.id, player_id: input.playerId, injury_id: injuryId, body, created_by: viewer.userId });
  if (error) return { ok: false, error: consentError(error.message) };
  revalidatePath(`/player/${input.playerId}`);
  return { ok: true };
}

export async function deleteMedicalNoteAction(noteId: string, playerId: string): Promise<Res> {
  if (!UUID.test(noteId)) return { ok: false, error: "unknown note" };
  const { error } = await (await createClient()).from("medical_notes").delete().eq("id", noteId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/player/${playerId}`);
  return { ok: true };
}
