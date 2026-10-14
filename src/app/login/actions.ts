"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

// where a sign-in may return to: a claim, a staff invite, sign-up, a player's consent
const RETURN_TO = /^\/(claim\/[0-9a-f-]{36}|join\/[0-9a-f-]{36}|start(\/[a-z-]+)?)$/;

export async function sendMagicLink(
  email: string,
  next?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createClient();
  const h = await headers();
  const origin =
    h.get("origin") ?? `https://${h.get("host") ?? "injury-time.vercel.app"}`;
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback${next && RETURN_TO.test(next) ? `?next=${encodeURIComponent(next)}` : ""}` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
