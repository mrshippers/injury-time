"use server";

import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

type Res = { ok: true } | { ok: false; error: string };
export type BrowserSubscription = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

const B64URL = /^[A-Za-z0-9_-]+=*$/;

/** Keep this device's push address for the signed-in member. RLS checks it is theirs and their club. */
export async function saveSubscriptionAction(sub: BrowserSubscription): Promise<Res> {
  const viewer = await getViewer();
  if (!viewer.userId || viewer.guest) return { ok: false, error: "sign in to your club to get notifications" };
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 1000) return { ok: false, error: "that browser gave an address we can't use" };
  if (!B64URL.test(p256dh) || !B64URL.test(auth) || p256dh.length > 200 || auth.length > 100) return { ok: false, error: "that browser gave keys we can't use" };
  const supabase = await createClient();
  // the same device re-subscribing replaces its old row
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ user_id: viewer.userId, club_id: viewer.club.id, endpoint, p256dh, auth });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeSubscriptionAction(endpoint: string): Promise<Res> {
  const viewer = await getViewer();
  if (!viewer.userId) return { ok: true };
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) return { ok: false, error: "no such device" };
  const { error } = await (await createClient()).from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
