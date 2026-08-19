import { createBrowserClient } from '@supabase/ssr'

import type { Database } from '@/lib/types'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

/**
 * Browser-side Supabase client. Safe to call repeatedly — `createBrowserClient`
 * memoises per (url, key), so every component gets the same instance and the
 * same auth state.
 */
export function createClient() {
  return createBrowserClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY())
}
