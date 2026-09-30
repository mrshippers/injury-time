import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * The refresh's three endings: done, nothing-to-do, DEGRADED.
 *
 * The one that matters is the third: a feed read or a write that fails must
 * not be reported as "nothing-to-do" - that is indistinguishable from a
 * genuinely quiet week unless the route says which one it had.
 */
vi.mock('@/lib/supabase/env', () => ({
  SUPABASE_URL: () => 'https://example.supabase.co',
  SUPABASE_ANON_KEY: () => 'anon',
}))

const loadSeason = vi.fn()
const refreshSeason = vi.fn()
vi.mock('@/lib/league', () => ({ loadSeason, refreshSeason }))

type Row = Record<string, unknown>
type TableData = { data: Row | Row[] | null; error: { message: string } | null }

let tables: Record<string, TableData>
let inserted: Row[]

function builder(name: string) {
  const t = tables[name] ?? { data: null, error: null }
  const chain: Record<string, unknown> = {}
  const self = () => chain
  for (const m of ['select', 'eq', 'gte']) chain[m] = self
  chain.maybeSingle = async () => ({ data: t.data, error: t.error })
  chain.limit = async () => ({ data: t.data, error: t.error })
  chain.insert = async (row: Row) => {
    if (t.error) return { error: t.error }
    inserted.push(row)
    return { error: null }
  }
  return chain
}

// the route writes with the service role since Belstone went read-only (0010)
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: (name: string) => builder(name) }),
}))

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: (name: string) => builder(name) }),
}))

const { GET } = await import('@/app/api/cron/season-refresh/route')

const authed = () =>
  new Request('http://x/api/cron/season-refresh', { headers: { authorization: 'Bearer s3cret' } })

const emptyReport = { source: 'snapshot', results: 0, fixturesAdded: 0, standings: 0, progress: 0, playersUpdated: [], unmatched: [], resultsChanged: [], playersChanged: [], tableNew: false }

beforeEach(() => {
  process.env.CRON_SECRET = 's3cret'
  inserted = []
  tables = {
    clubs: { data: { id: 'c1', name: 'Belstone', slug: 'belstone', season: '2026-27' }, error: null },
    notifications: { data: [], error: null },
  }
  loadSeason.mockReset().mockResolvedValue({ source: 'snapshot', data: {} })
  refreshSeason.mockReset().mockResolvedValue(emptyReport)
})

describe('season refresh', () => {
  it('refuses without the cron secret', async () => {
    const res = await GET(new Request('http://x/api/cron/season-refresh'))
    expect(res.status).toBe(401)
    expect(inserted).toHaveLength(0)
  })

  it('refuses a wrong secret', async () => {
    const res = await GET(new Request('http://x/', { headers: { authorization: 'Bearer nope' } }))
    expect(res.status).toBe(401)
  })

  it('reports nothing-to-do when the feed adds nothing new', async () => {
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('nothing-to-do')
    expect(inserted).toHaveLength(0)
  })

  it('files one notice naming what drifted', async () => {
    refreshSeason.mockResolvedValue({
      ...emptyReport,
      fixturesAdded: 2,
      results: 17,
      resultsChanged: ['2026-09-22 v Maidenhead Town 5-1'],
      playersUpdated: ['A Kane'],
      playersChanged: ['A Kane'],
      unmatched: ['J Smith'],
    })
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe('done')
    expect(inserted).toHaveLength(1)
    expect(inserted[0].kind).toBe('notice')
    expect(inserted[0].body).toContain('2 fixture(s) added')
    expect(inserted[0].body).toContain('J Smith')
    expect(inserted[0].body).toContain('Maidenhead Town 5-1')
  })

  it('a night that rewrote every row but changed nothing is nothing-to-do, not a notice', async () => {
    // what prod did for weeks: 10 results upserted, 20 players rewritten, same numbers, a notice every morning
    refreshSeason.mockResolvedValue({ ...emptyReport, results: 10, standings: 22, progress: 9, playersUpdated: Array(20).fill('x'), unmatched: ['Kimber'] })
    const res = await GET(authed())
    const body = await res.json()
    expect(body.status).toBe('nothing-to-do')
    expect(inserted).toHaveLength(0)
  })

  it('a second run the same day files nothing new', async () => {
    refreshSeason.mockResolvedValue({ ...emptyReport, tableNew: true })
    tables.notifications = { data: [{ id: 'n1' }], error: null }
    const res = await GET(authed())
    const body = await res.json()
    expect(body.status).toBe('done')
    expect(body.already_notified).toBe(true)
    expect(inserted).toHaveLength(0)
  })

  it('reports DEGRADED, not nothing-to-do, when the club lookup fails', async () => {
    tables.clubs = { data: null, error: { message: 'JWT expired' } }
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(inserted).toHaveLength(0)
  })

  it('reports DEGRADED when the club has not been seeded yet', async () => {
    tables.clubs = { data: null, error: null }
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.reason).toMatch(/run scripts\/seed-belstone/)
  })

  it('reports DEGRADED when the feed throws', async () => {
    loadSeason.mockRejectedValue(new Error('no season feed'))
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(inserted).toHaveLength(0)
  })

  it('reports DEGRADED (not done) when the write to refresh fails', async () => {
    refreshSeason.mockRejectedValue(new Error('constraint violation'))
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(inserted).toHaveLength(0)
  })

  it('reports DEGRADED when the drift landed but the notice failed to file', async () => {
    refreshSeason.mockResolvedValue({ ...emptyReport, fixturesAdded: 1 })
    tables.notifications = { data: [], error: { message: 'rls denied' } }
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
  })
})
