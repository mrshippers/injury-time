// server only: reads with the admin client, so it is never imported by a client component.

import { createAdminClient } from "@/lib/supabase/admin";
import type { ClubStaff } from "@/lib/types";

export type MemberRow = { user_id: string; role: string; created_at: string; email: string | null; staff: ClubStaff | null };

/**
 * Who can sign in to the club and what as, joined to the staff record that names them. club_members RLS
 * shows a person only their own row, so this is read with the admin client, for the manager only.
 */
export async function listMembers(clubId: string): Promise<MemberRow[]> {
  const admin = createAdminClient();
  const [{ data: members }, { data: staff }] = await Promise.all([
    admin.from("club_members").select("user_id, role, created_at").eq("club_id", clubId).order("created_at", { ascending: true }),
    admin.from("club_staff").select("*").eq("club_id", clubId),
  ]);
  const byUser = new Map(((staff ?? []) as ClubStaff[]).filter((s) => s.user_id).map((s) => [s.user_id as string, s]));
  const out: MemberRow[] = [];
  for (const m of members ?? []) {
    if (m.role === "player") continue;
    let email: string | null = null;
    try {
      const { data } = await admin.auth.admin.getUserById(m.user_id);
      email = data.user?.email ?? null;
    } catch {}
    out.push({ user_id: m.user_id, role: m.role, created_at: m.created_at, email, staff: byUser.get(m.user_id) ?? null });
  }
  return out;
}
