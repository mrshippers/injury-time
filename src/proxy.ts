import type { NextRequest } from 'next/server'

import { updateSession } from '@/lib/supabase/session'

/**
 * Next.js 16 renamed the `middleware` file convention to `proxy`; a
 * `src/middleware.ts` in this version is dead code that never runs. See
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Everything except static assets. The proxy touches cookies on each
     * matched request, so letting it run on `_next/static` would both waste
     * work and put Set-Cookie on cacheable asset responses.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|woff2?)$).*)',
  ],
}
