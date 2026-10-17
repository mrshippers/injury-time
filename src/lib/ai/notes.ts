/** Store and fetch what the analyst wrote, keyed per club, kind and match, so the same words are paid for once. */
import { createAdminClient } from "@/lib/supabase/admin";

export type NoteKind = "brief" | "report" | "nudge" | "answer";

export async function getNote<T>(clubId: string, kind: NoteKind, key: string): Promise<{ body: T; model: string | null; created_at: string } | null> {
  const db = createAdminClient();
  const { data } = await db.from("ai_notes").select("body, model, created_at").eq("club_id", clubId).eq("kind", kind).eq("key", key).maybeSingle();
  return data ? { body: data.body as T, model: (data.model as string | null) ?? null, created_at: data.created_at as string } : null;
}

export async function putNote(clubId: string, kind: NoteKind, key: string, body: unknown, model: string): Promise<void> {
  const db = createAdminClient();
  await db.from("ai_notes").upsert({ club_id: clubId, kind, key, body, model, created_at: new Date().toISOString() }, { onConflict: "club_id,kind,key" });
}
