/**
 * Who is looking, at which club, as what. Server-side only.
 *
 * A signed-out visitor is a guest on the public demo clubs and is treated as
 * a manager so every surface can be tried; the `guest` flag lets a page say
 * so. A signed-in member gets the role on their club_members row.
 */
import { cookies } from "next/headers";

import { can, type Capability } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { Club, ClubRole } from "@/lib/types";

export const CLUB_COOKIE = "it.club";

export type Viewer = {
  userId: string | null;
  email: string | null;
  club: Club;
  role: ClubRole;
  guest: boolean;
  /** the player row linked to this user, if they are a player */
  playerId: string | null;
  can: (capability: Capability) => boolean;
};

async function pickClub(userId: string | null): Promise<Club> {
  const supabase = await createClient();
  const jar = await cookies();
  const wanted = jar.get(CLUB_COOKIE)?.value ?? null;

  if (userId) {
    const { data: memberships } = await supabase
      .from("club_members")
      .select("club_id, role")
      .eq("user_id", userId);
    const ids = (memberships ?? []).map((m) => m.club_id);
    if (ids.length > 0) {
      const chosen = wanted && ids.includes(wanted) ? wanted : ids[0];
      const { data: club, error } = await supabase.from("clubs").select("*").eq("id", chosen).single();
      if (error) throw error;
      return club as Club;
    }
  }

  // guests: the public clubs, the cookie picks one, Belstone by default
  const { data: demos, error } = await supabase.from("clubs").select("*").eq("is_demo", true).order("created_at");
  if (error) throw error;
  const list = (demos ?? []) as Club[];
  if (list.length === 0) throw new Error("no public club to show");
  const chosen = wanted ? list.find((c) => c.id === wanted || (c.slug !== null && c.slug === wanted)) : undefined;
  return chosen ?? list.find((c) => c.slug === "belstone") ?? list[0];
}

export async function getViewer(): Promise<Viewer> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id ?? null;
  const club = await pickClub(userId);

  let role: ClubRole = "manager";
  let guest = true;
  let playerId: string | null = null;
  if (userId) {
    const { data: membership } = await supabase
      .from("club_members")
      .select("role")
      .eq("club_id", club.id)
      .eq("user_id", userId)
      .maybeSingle();
    if (membership) {
      role = membership.role as ClubRole;
      guest = false;
    }
    if (role === "player") {
      const { data: me } = await supabase
        .from("players")
        .select("id")
        .eq("club_id", club.id)
        .eq("user_id", userId)
        .maybeSingle();
      playerId = me?.id ?? null;
    }
  }

  return {
    userId,
    email: auth.user?.email ?? null,
    club,
    role,
    guest,
    playerId,
    can: (capability) => can(role, capability),
  };
}

/** The public clubs a guest can switch between. */
export async function listPublicClubs(): Promise<Club[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("clubs").select("*").eq("is_demo", true).order("created_at");
  return (data ?? []) as Club[];
}
