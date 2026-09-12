import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * The chaser's three endings: done, nothing-to-do, and DEGRADED.
 *
 * The one that matters is the third. A run whose queries are failing returns an
 * empty chase list, and an empty list is indistinguishable from a squad that has
 * all called in unless the route says so itself.
 */
vi.mock('@/lib/supabase/env', () => ({
  SUPABASE_URL: () => 'https://example.supabase.co',
  SUPABASE_ANON_KEY: () => 'anon',
}))

type Row = Record<string, unknown>
type TableData = { data: Row[] | null; error: { message: string } | null }

let tables: Record<string, TableData>
let inserted: Row[]

function builder(name: string) {
  const t = tables[name] ?? { data: [], error: null }
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'eq', 'neq', 'gte', 'order', 'limit']) chain[m] = self
  chain.maybeSingle = async () => ({ data: t.data?.[0] ?? null, error: t.error })
  chain.insert = async (row: Row) => {
    if (t.error) return { error: t.error }
    inserted.push(row)
    return { error: null }
  }
  chain.then = (resolve: (v: TableData) => unknown) => resolve(t)
  return chain
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (name: string) => builder(name) }),
}))

const { GET } = await import('@/app/api/cron/availability-chaser/route')

const authed = () =>
  new Request('http://x/api/cron/availability-chaser', {
    headers: { authorization: 'Bearer s3cret' },
  })

beforeEach(() => {
  process.env.CRON_SECRET = 's3cret'
  inserted = []
  tables = {
    clubs: { data: [{ id: 'c1', name: 'Kilburn Athletic' }], error: null },
    fixtures: { data: [{ id: 'f1', match_date: '2099-01-01', opponent: 'Hendon', venue: 'H' }], error: null },
    players: { data: [{ id: 'p1', name: 'A Kane' }, { id: 'p2', name: 'B Toney' }], error: null },
    match_calls: { data: [{ player_id: 'p1' }], error: null },
    notifications: { data: [], error: null },
  }
})

describe('availability chaser', () => {
  it('refuses without the cron secret', async () => {
    const res = await GET(new Request('http://x/api/cron/availability-chaser'))
    expect(res.status).toBe(401)
    expect(inserted).toHaveLength(0)
  })

  it('refuses a wrong secret, however well formed', async () => {
    const res = await GET(
      new Request('http://x/', { headers: { authorization: 'Bearer nope' } }),
    )
    expect(res.status).toBe(401)
  })

  it('names only the players who have not called in', async () => {
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.results[0].chased).toEqual(['B Toney'])
    expect(inserted).toHaveLength(1)
    expect(inserted[0].body).toBe('B Toney')
  })

  it('does not post a second notice for the same fixture', async () => {
    tables.notifications = { data: [{ id: 'n1' }], error: null }
    const res = await GET(authed())
    const body = await res.json()
    expect(body.results[0].already_notified).toBe(true)
    expect(inserted).toHaveLength(0)
  })

  it('reports DEGRADED rather than an empty chase when a query fails', async () => {
    tables.players = { data: null, error: { message: 'JWT expired' } }
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.degraded).toBe(true)
    expect(body.results[0].status).toBe('degraded')
    expect(inserted).toHaveLength(0)
  })

  it('never chases Belstone', async () => {
    tables.clubs = { data: [], error: null }
    const res = await GET(authed())
    const body = await res.json()
    expect(body.results ?? []).toHaveLength(0)
    expect(inserted).toHaveLength(0)
  })
})
