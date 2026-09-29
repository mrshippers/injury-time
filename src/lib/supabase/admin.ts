import { createClient as createSupabase } from "@supabase/supabase-js";

import type { Database } from "@/lib/types";

import { SUPABASE_URL } from "./env";

/**
 * Service-role client: bypasses RLS. Only for the two things no browser may
 * touch, a club's league-feed key and the check-in links, and only from server
 * actions and cron routes that have already checked who is asking.
 */
export function createAdminClient() {
  if (typeof window !== "undefined") throw new Error("the admin client is server-only");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (Vercel env, and .env.local for dev)");
  return createSupabase<Database>(SUPABASE_URL(), key, { auth: { persistSession: false, autoRefreshToken: false } });
}
