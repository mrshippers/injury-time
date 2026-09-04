"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { CLUB_COOKIE, listPublicClubs } from "@/lib/viewer";

/** A guest picks which public club to look at. Members are pinned to their own. */
export async function switchClub(clubId: string): Promise<void> {
  const clubs = await listPublicClubs();
  if (!clubs.some((c) => c.id === clubId)) return;
  const jar = await cookies();
  jar.set(CLUB_COOKIE, clubId, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
}
