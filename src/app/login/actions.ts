"use server";

import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

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
    options: { emailRedirectTo: `${origin}/auth/callback${next && next.startsWith("/claim/") ? `?next=${encodeURIComponent(next)}` : ""}` },
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
