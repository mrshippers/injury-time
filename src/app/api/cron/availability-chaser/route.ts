import { pushToUsers } from '@/lib/push/send'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Availability chaser.
 *
 * Finds players with no call for the next fixture and posts ONE notice naming
 * them, so the manager chases a list rather than a memory.
 *
 * Three things this deliberately does NOT do:
 *
 *  - It does not email players. There is no email column on `players`, and
 *    inventing an address to send to is worse than not sending.
 *  - It does not touch Belstone. That club is real and carries public data
 *    only; a chase implies availability we do not have and must not invent.
 *  - It does not write a call on a player's behalf. Absence of a call is the
 *    finding. Filling it in would destroy the only signal there is.
 *
 * Endings are three, not two: done, nothing-to-do, and DEGRADED. A run whose
 * queries are failing must not report an empty chase list as a quiet week.
 */
export const dynamic = 'force-dynamic'

const MAX_CONSECUTIVE_FAILURES = 3

type Degraded = { status: 'degraded'; reason: string; failures: number }
type Summary = {
  status: 'done' | 'nothing-to-do'
  club: string
  fixture?: string
  chased: string[]
  already_notified?: boolean
  pushed?: number
}

function unauthorised() {
  return Response.json({ error: 'unauthorised' }, { status: 401 })
}

export async function GET(request: Request) {
  // Authorisation lives on the route, not in a prompt: without the shared
  // secret this endpoint does nothing, however convincing the caller.
  const secret = process.env.CRON_SECRET
  const offered = request.headers.get('authorization')
  if (!secret || offered !== `Bearer ${secret}`) return unauthorised()

  // service role since real clubs are private to anon; the club filter below is the scope
  const db = createAdminClient()
  let failures = 0
  const degrade = (reason: string): Degraded => ({ status: 'degraded', reason, failures })

  // real clubs (their own squads, their own calls) and clubs open to try. never a
  // real club shown from public data (Belstone: is_demo and not demo_writable),
  // which has no calls to chase. keyed on the columns, not a name
  const all = await db.from('clubs').select('id, name, is_demo, demo_writable')
  const clubs = { error: all.error, data: (all.data ?? []).filter((c) => c.demo_writable === true || c.is_demo === false) }
  if (clubs.error) return Response.json(degrade(`clubs: ${clubs.error.message}`), { status: 503 })
  if (!clubs.data?.length) {
    return Response.json({ status: 'nothing-to-do', club: '-', chased: [] } satisfies Summary)
  }

  const out: (Summary | Degraded)[] = []

  for (const club of clubs.data) {
    const today = new Date().toISOString().slice(0, 10)

    const fixture = await db
      .from('fixtures')
      .select('id, match_date, opponent, venue')
      .eq('club_id', club.id)
      .gte('match_date', today)
      .order('match_date', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (fixture.error) {
      failures += 1
      out.push(degrade(`fixtures(${club.name}): ${fixture.error.message}`))
      if (failures >= MAX_CONSECUTIVE_FAILURES) break
      continue
    }
    if (!fixture.data) {
      out.push({ status: 'nothing-to-do', club: club.name, chased: [] })
      continue
    }

    const [players, calls] = await Promise.all([
      db.from('players').select('id, name, user_id').eq('club_id', club.id),
      db.from('match_calls').select('player_id').eq('fixture_id', fixture.data.id),
    ])
    if (players.error || calls.error) {
      failures += 1
      out.push(degrade(`squad(${club.name}): ${(players.error ?? calls.error)!.message}`))
      if (failures >= MAX_CONSECUTIVE_FAILURES) break
      continue
    }
    failures = 0

    const answered = new Set((calls.data ?? []).map((c) => c.player_id))
    const silent = (players.data ?? []).filter((p) => !answered.has(p.id))
    if (!silent.length) {
      out.push({ status: 'nothing-to-do', club: club.name, fixture: fixture.data.opponent, chased: [] })
      continue
    }

    // Idempotency. The loop reruns; the notice must not. One chase per fixture,
    // keyed to the fixture, not to this attempt.
    const existing = await db
      .from('notifications')
      .select('id')
      .eq('fixture_id', fixture.data.id)
      .eq('kind', 'call')
      .limit(1)
      .maybeSingle()
    if (existing.error) {
      failures += 1
      out.push(degrade(`notifications(${club.name}): ${existing.error.message}`))
      if (failures >= MAX_CONSECUTIVE_FAILURES) break
      continue
    }
    if (existing.data) {
      out.push({
        status: 'done',
        club: club.name,
        fixture: fixture.data.opponent,
        chased: silent.map((p) => p.name),
        already_notified: true,
      })
      continue
    }

    const write = await db.from('notifications').insert({
      club_id: club.id,
      kind: 'call',
      fixture_id: fixture.data.id,
      title: `${silent.length} still to call in for ${fixture.data.opponent}`,
      // The names ARE the audit of what the run read: the state that caused
      // the notice, kept beside the notice itself.
      body: silent.map((p) => p.name).join(', '),
      audience: ['manager', 'coach'],
    })
    if (write.error) {
      failures += 1
      out.push(degrade(`insert(${club.name}): ${write.error.message}`))
      if (failures >= MAX_CONSECUTIVE_FAILURES) break
      continue
    }

    // the players themselves, on their phones, once per fixture (the notice above is the dedupe key)
    const linked = silent.map((p) => (p as { user_id?: string | null }).user_id).filter((u): u is string => Boolean(u))
    const pushed = await pushToUsers(club.id, linked, {
      title: `are you in for ${fixture.data.opponent}?`,
      body: 'tap to say in, out or unsure',
      url: '/team',
      tag: `call:${fixture.data.id}`,
    }).catch(() => null)

    out.push({
      status: 'done',
      club: club.name,
      fixture: fixture.data.opponent,
      chased: silent.map((p) => p.name),
      pushed: pushed?.sent ?? 0,
    })
  }

  const degraded = out.some((r) => r.status === 'degraded')
  return Response.json({ ran_at: new Date().toISOString(), degraded, results: out },
    { status: degraded ? 503 : 200 })
}
