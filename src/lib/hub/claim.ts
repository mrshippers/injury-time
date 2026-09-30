"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { CLUB_COOKIE, getViewer } from "@/lib/viewer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Res<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Manager or coach: a link that hands this player's page to the player. The database checks the role; a re-mint kills the old link. */
export async function mintClaimAction(playerId: string): Promise<Res<{ path: string }>> {
  if (!UUID.test(playerId)) return { ok: false, error: "no such player" };
  const viewer = await getViewer();
  if (viewer.guest) return { ok: false, error: "only the club's own manager or coach hands a page over" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mint_player_claim", { pid: playerId });
  if (error || !data) return { ok: false, error: error?.message ?? "could not make the link" };
  return { ok: true, path: `/claim/${data}` };
}

/** The signed-in player takes their page. */
export async function claimAction(token: string): Promise<Res<{ playerId: string }>> {
  if (!UUID.test(token)) return { ok: false, error: "that link is not right" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "sign in first" };
  const { data, error } = await supabase.rpc("claim_player", { token });
  if (error || !data) return { ok: false, error: error?.message ?? "could not claim" };
  const { data: p } = await supabase.from("players").select("club_id").eq("id", data).maybeSingle();
  if (p) (await cookies()).set(CLUB_COOKIE, p.club_id, { path: "/", sameSite: "lax", httpOnly: true, secure: true, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true, playerId: data };
}
