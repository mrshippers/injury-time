"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { FEET, HUB_POSITIONS, type Clip } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

import { MOMENT_KINDS } from "./hub";

export type HubInput = {
  nickname?: string;
  shirtName?: string;
  foot?: string;
  position?: string;
  song?: string;
  boots?: string;
  hero?: string;
  previousClubs?: string;
  bio?: string;
  /** "clipId@seconds", or empty for none */
  pinned?: string;
};
export type HubState = { ok: true; message: string } | { ok: false; message: string } | null;

/** Server actions are reachable by direct POST: every field is re-checked here, the table's checks are the backstop. */
function text(v: unknown, field: string, max: number): string | null {
  if (v === undefined || v === null) return null;
  if (typeof v !== "string") throw new Error(`${field} must be text`);
  const t = v.trim().replace(/\s+/g, " ");
  if (t.length > max) throw new Error(`${field} is too long (${max} characters)`);
  return t || null;
}
function pick<T extends string>(allowed: readonly T[], v: unknown, field: string): T | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string" || !(allowed as readonly string[]).includes(v)) throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  return v as T;
}

export async function saveHubAction(playerId: string, input: HubInput): Promise<HubState> {
  try {
    const viewer = await getViewer();
    if (viewer.readOnly) return { ok: false, message: "this club is read-only: its players fill their pages in once the club links them" };
    const own = viewer.playerId === playerId;
    const staff = viewer.role === "manager" || viewer.role === "coach";
    if (!own && !staff && !viewer.guest) return { ok: false, message: "only the player, or their manager or coach, edits this page" };

    const previous = (text(input?.previousClubs, "previous clubs", 400) ?? "")
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    if (previous.length > 8) throw new Error("eight previous clubs at most");
    if (previous.some((c) => c.length > 40)) throw new Error("a club name is too long (40 characters)");

    const supabase = await createClient();
    let pinned: { clip_id: string; t: number } | null = null;
    const pin = text(input?.pinned, "pinned moment", 80);
    if (pin) {
      const [clipId, t] = pin.split("@");
      const { data: clip } = await supabase.from("clips").select("events").eq("id", clipId).eq("club_id", viewer.club.id).maybeSingle();
      const ok = (clip as Pick<Clip, "events"> | null)?.events?.some((e) => e.t === Number(t) && e.player_id === playerId && MOMENT_KINDS.includes(e.kind));
      if (!ok) throw new Error("that moment is not one of yours on the club's film");
      pinned = { clip_id: clipId, t: Number(t) };
    }

    const { error } = await supabase.from("player_profiles").upsert(
      {
        player_id: playerId,
        club_id: viewer.club.id,
        nickname: text(input?.nickname, "nickname", 24),
        shirt_name: text(input?.shirtName, "name on the shirt", 14)?.toUpperCase() ?? null,
        preferred_foot: pick(FEET, input?.foot, "foot"),
        best_position: pick(HUB_POSITIONS, input?.position, "position"),
        walkout_song: text(input?.song, "walk-out song", 60),
        boots: text(input?.boots, "boots", 40),
        hero: text(input?.hero, "hero", 40),
        previous_clubs: previous,
        bio: text(input?.bio, "about you", 200),
        pinned,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "player_id" },
    );
    if (error) throw new Error(error.code === "42501" ? "not allowed on this club" : error.message);
    revalidatePath(`/player/${playerId}/hub`);
    return { ok: true, message: "saved, that's your page" };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "could not save" };
  }
}
