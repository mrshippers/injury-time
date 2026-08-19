import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import type { Database } from '@/lib/types'

import { SUPABASE_ANON_KEY, SUPABASE_URL } from './env'

/**
 * Refreshes the Supabase session on every matched request and writes the
 * rotated tokens onto the outgoing response.
 *
 * Two things here are load-bearing and easy to break:
 *
 * 1. Cookies are written to BOTH `request.cookies` and `response.cookies`. The
 *    request copy is what the Server Component render downstream reads; the
 *    response copy is what the browser stores. Set only one and the session is
 *    a request behind, forever.
 *
 * 2. `getClaims()` is awaited before returning. A token refresh that completes
 *    after the response is committed cannot be written, so the next request
 *    refreshes again — a slow loop that looks like flaky auth.
 *
 * @supabase/ssr 0.12 passes cache-control headers alongside the cookies; they
 * must land on the response, or a CDN can cache one visitor's Set-Cookie and
 * serve it to another.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(SUPABASE_URL(), SUPABASE_ANON_KEY(), {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        response = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options)
        }
        for (const [key, headerValue] of Object.entries(headers ?? {})) {
          response.headers.set(key, headerValue)
        }
      },
    },
  })

  await supabase.auth.getClaims()

  return response
}
