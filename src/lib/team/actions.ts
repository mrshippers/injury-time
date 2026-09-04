"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { CALL_STATUSES, CLUB_ROLES, NOTIFICATION_KINDS, type CallStatus, type ClubRole, type NotificationKind } from "@/lib/types";
import { getViewer } from "@/lib/viewer";

/**
 * Server actions are reachable by direct POST, so every field is re-checked
 * against the domain unions here rather than trusted from the form.
 */
type Fail = { ok: false; error: string };

function oneOf<T extends string>(allowed: readonly T[], value: unknown, field: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new Error(`${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function text(value: unknown, field: string, max: number, required = false): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new Error(`${field} is required`);
    return null;
  }
  if (typeof value !== "string") throw new Error(`${field} must be text`);
  const t = value.trim();
  if (t.length > max) throw new Error(`${field} is too long (${max} characters)`);
  return t.length === 0 ? null : t;
}

export type SetCallInput = { fixtureId: string; playerId: string; status: string; note?: string };

/** A player calls in, out or unsure. Staff can call for anyone; a player only for themselves. */
export async function setCallAction(input: SetCallInput): Promise<{ ok: true } | Fail> {
  try {
    const viewer = await getViewer();
    const fixtureId = text(input?.fixtureId, "fixtureId", 64, true)!;
    const playerId = text(input?.playerId, "playerId", 64, true)!;
    const status: CallStatus = oneOf(CALL_STATUSES, input?.status, "status");
    const note = text(input?.note, "note", 140);

    const staff = viewer.role !== "player";
    if (!staff && viewer.playerId !== playerId) throw new Error("you can only call for yourself");

    const supabase = await createClient();
    const { error } = await supabase.from("match_calls").upsert(
      {
        club_id: viewer.club.id,
        fixture_id: fixtureId,
        player_id: playerId,
        status,
        note,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "fixture_id,player_id" },
    );
    if (error) throw error;
    revalidatePath("/team");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "could not save the call" };
  }
}

export type PostNoticeInput = { kind: string; title: string; body?: string; audience?: string[]; fixtureId?: string | null };

/** Staff post to the squad. Guests on a demo club may too; that is how the demo is tried. */
export async function postNoticeAction(input: PostNoticeInput): Promise<{ ok: true; id: string } | Fail> {
  try {
    const viewer = await getViewer();
    if (!viewer.can("post_notice")) throw new Error("only staff can post a notice");
    const kind: NotificationKind = oneOf(NOTIFICATION_KINDS, input?.kind, "kind");
    const title = text(input?.title, "title", 90, true)!;
    const body = text(input?.body, "body", 600);
    const fixtureId = text(input?.fixtureId, "fixtureId", 64);
    const audienceRaw = Array.isArray(input?.audience) && input.audience.length > 0 ? input.audience : [...CLUB_ROLES];
    const audience = audienceRaw.map((r) => oneOf(CLUB_ROLES, r, "audience")) as ClubRole[];

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        club_id: viewer.club.id,
        kind,
        title,
        body,
        fixture_id: fixtureId,
        audience,
        created_by: viewer.userId,
      })
      .select("id")
      .single();
    if (error) throw error;
    revalidatePath("/team");
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "could not post the notice" };
  }
}
