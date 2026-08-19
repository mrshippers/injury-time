import { cookies } from 'next/headers'

import { createServerClient } from '@supabase/ssr'

import type { Database } from '@/lib/types'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

/**
 * Server-side Supabase client, scoped to one request's cookies.
 *
 * Create a new one per request — never hoist this into a module-level constant,
 * or one visitor's session leaks into another's render.
 *
 * `setAll` throws inside Server Components (cookies are read-only once
 * rendering has begun). That is expected and safe to swallow: the proxy
 * (src/proxy.ts) refreshes the session on every request, so a token written
 * there is already on the response by the time a page renders.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Component render — the proxy owns the refresh. See above.
        }
      },
    },
  })
}
