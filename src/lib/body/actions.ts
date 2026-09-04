"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { BodyParams } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

import { MORPHS, rangeCm } from "./params";

export type SaveBodyResult = { ok: true; params: BodyParams | null } | { ok: false; error: string };

/**
 * Saves a player's measurements. Hand-validated: a Server Action is reachable
 * by direct POST, so every value is checked against the model's own range and
 * anything else is dropped rather than trusted.
 */
export async function saveBodyParams(playerId: string, input: unknown): Promise<SaveBodyResult> {
  const viewer = await getViewer();
  if (!viewer.guest && !viewer.can("edit_body")) return { ok: false, error: "only medical staff can change measurements" };
  if (typeof playerId !== "string" || !/^[0-9a-f-]{36}$/i.test(playerId)) return { ok: false, error: "bad player" };

  let params: BodyParams | null = null;
  if (input && typeof input === "object") {
    const clean: BodyParams = {};
    for (const m of MORPHS) {
      const v = (input as Record<string, unknown>)[m.key];
      if (typeof v !== "number" || !Number.isFinite(v)) continue;
      const r = rangeCm(m);
      clean[m.key] = Math.round(Math.min(r.max, Math.max(r.min, v)) * 10) / 10;
    }
    params = Object.keys(clean).length > 0 ? clean : null;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("players")
    .update({ body_params: params })
    .eq("id", playerId)
    .eq("club_id", viewer.club.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/player/${playerId}`);
  return { ok: true, params };
}
