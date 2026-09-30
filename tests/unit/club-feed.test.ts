import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The club-feeds cron's endings: done, nothing-to-do (no club has a key),
 * DEGRADED (a named club failed). A failure is written to that club's key row
 * so its manager sees it on /club, and the key never leaves the server.
 */
const syncClubFeed = vi.fn()
vi.mock('@/lib/club/sync', () => ({ syncClubFeed }))

type Row = Record<string, unknown>
let keys: { data: Row[] | null; error: { message: string } | null }
let clubs: Row[]
let updates: { table: string; row: Row; id: unknown }[]

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      let id: unknown
      const chain: Record<string, unknown> = {}
      chain.select = () => (table === 'club_feed_keys' ? Promise.resolve(keys) : chain)
      chain.eq = (_c: string, v: unknown) => ((id = v), chain)
      chain.maybeSingle = async () => ({ data: clubs.find((c) => c.id === id) ?? null, error: null })
      chain.update = (row: Row) => ({ eq: async (_c: string, v: unknown) => (updates.push({ table, row, id: v }), { error: null }) })
      return chain
    },
  }),
}))

const { GET } = await import('@/app/api/cron/club-feeds/route')
const authed = () => new Request('http://x/api/cron/club-feeds', { headers: { authorization: 'Bearer s3cret' } })

beforeEach(() => {
  process.env.CRON_SECRET = 's3cret'
  keys = { data: [{ club_id: 'a', api_key: 'KEY-A-secret' }], error: null }
  clubs = [{ id: 'a', name: 'Alpha FC', slug: 'alpha', fwp_team_id: 123 }]
  updates = []
  syncClubFeed.mockReset().mockResolvedValue({ ok: true, report: { results: 12 } })
})

describe('club feeds', () => {
  it('refuses without the cron secret, and touches nothing', async () => {
    const res = await GET(new Request('http://x/api/cron/club-feeds'))
    expect(res.status).toBe(401)
    expect(syncClubFeed).not.toHaveBeenCalled()
  })

  it('nothing-to-do when no club has connected a key', async () => {
    keys = { data: [], error: null }
    const body = await (await GET(authed())).json()
    expect(body.status).toBe('nothing-to-do')
  })

  it('DEGRADED, not nothing-to-do, when the keys cannot be read', async () => {
    keys = { data: null, error: { message: 'permission denied' } }
    const res = await GET(authed())
    expect(res.status).toBe(503)
    expect((await res.json()).status).toBe('degraded')
  })

  it("syncs each club with its own key and notes it on that club's row", async () => {
    const res = await GET(authed())
    const body = await res.json()
    expect(body.status).toBe('done')
    expect(syncClubFeed.mock.calls[0][2]).toEqual({ apiKey: 'KEY-A-secret', teamId: '123' })
    expect(updates).toEqual([expect.objectContaining({ table: 'club_feed_keys', id: 'a', row: expect.objectContaining({ last_sync_note: 'synced 12 results' }) })])
    expect(JSON.stringify(body)).not.toContain('KEY-A-secret')
  })

  it('DEGRADED naming the club when a sync fails, and the reason lands on its key row', async () => {
    keys = { data: [{ club_id: 'a', api_key: 'KEY-A-secret' }, { club_id: 'b', api_key: 'KEY-B-secret' }], error: null }
    clubs.push({ id: 'b', name: 'Beta Town', slug: 'beta', fwp_team_id: 456 })
    syncClubFeed.mockImplementation(async (_db: unknown, club: Row) =>
      club.id === 'b' ? { ok: false, reason: 'Football Web Pages refused the request (401)' } : { ok: true, report: { results: 3 } },
    )
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.failed[0]).toMatch(/^Beta Town: Football Web Pages refused/)
    expect(body.synced[0]).toMatch(/^Alpha FC/)
    expect(updates.find((u) => u.id === 'b')?.row.last_sync_note).toMatch(/refused/)
    expect(JSON.stringify(body)).not.toMatch(/KEY-[AB]-secret/)
  })

  it('a club with a key but no team id is named as failed, never skipped quietly', async () => {
    clubs[0].fwp_team_id = null
    const res = await GET(authed())
    const body = await res.json()
    expect(res.status).toBe(503)
    expect(body.failed[0]).toMatch(/no team id/)
    expect(syncClubFeed).not.toHaveBeenCalled()
  })
})
