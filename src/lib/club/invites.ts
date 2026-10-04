"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

import { siteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { CLUB_COOKIE, getViewer } from "@/lib/viewer";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Res<T> = ({ ok: true } & T) | { ok: false; error: string };

/** The manager makes a single-use link for a coach or medical. The database checks the role (0015). */
export async function mintInviteAction(role: string): Promise<Res<{ url: string }>> {
  if (role !== "coach" && role !== "medical") return { ok: false, error: "an invite is for a coach or medical" };
  const viewer = await getViewer();
  if (viewer.guest || viewer.club.is_demo) return { ok: false, error: "a real club's manager invites its own staff" };
  const { data, error } = await (await createClient()).rpc("mint_staff_invite", { cid: viewer.club.id, invite_role: role });
  if (error || !data) return { ok: false, error: error?.message ?? "could not make the link" };
  revalidatePath("/club");
  return { ok: true, url: await siteUrl(`/join/${data}`) };
}

/** The signed-in person takes the role on the link, and nothing more. */
export async function acceptInviteAction(token: string): Promise<Res<{ clubId: string }>> {
  if (!UUID.test(token)) return { ok: false, error: "that link is not right" };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "sign in first" };
  const { data, error } = await supabase.rpc("accept_staff_invite", { token });
  if (error || !data) return { ok: false, error: error?.message ?? "could not join" };
  (await cookies()).set(CLUB_COOKIE, data, { path: "/", sameSite: "lax", httpOnly: true, secure: true, maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
  return { ok: true, clubId: data };
}
