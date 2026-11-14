import { loadTraining } from '@/lib/club/training-data'
import { addDays, draftNight, nightsBetween, type DraftCheckin } from '@/lib/log/training'
import { pushEach, pushToClub } from '@/lib/push/send'
import { confirmPayload, nightsToChase, reminderItems } from '@/lib/push/training'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Training reminders.
 *
 * Once a morning, for each club with a training schedule:
 *
 *  - players who asked for it are told about training that evening;
 *  - the manager and coaches are asked to confirm a night that has finished,
 *    for three mornings, and then left alone. A night that is confirmed or
 *    marked not held is never asked about again.
 *
 * What it deliberately does NOT do:
 *
 *  - It never logs a session. An unconfirmed night counts for nothing: the
 *    absence of a confirmation is the finding, the same as the availability chaser.
 *  - It does not touch Belstone, a real club shown from public data.
 *  - It does not send to anyone who turned that notice off (lib/push/prefs.ts).
 *
 * Daily, because the host's cron runs daily. An exact-time reminder would
 * need a finer schedule.
 *
 * Endings are three: done, nothing-to-do, and DEGRADED. A run whose queries
 * are failing must not report an empty day as a quiet one.
 */
export const dynamic = 'force-dynamic'

const MAX_CONSECUTIVE_FAILURES = 3

type Degraded = { status: 'degraded'; reason: string; failures: number }
type Summary = {
  status: 'done' | 'nothing-to-do'
  club: string
  reminded?: number
  asked?: string[]
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const offered = request.headers.get('authorization')
  if (!secret || offered !== `Bearer ${secret}`) return Response.json({ error: 'unauthorised' }, { status: 401 })

  const db = createAdminClient()
  let failures = 0
  const degrade = (reason: string): Degraded => ({ status: 'degraded', reason, failures })

  const all = await db.from('clubs').select('id, name, is_demo, demo_writable')
  if (all.error) return Response.json(degrade(`clubs: ${all.error.message}`), { status: 503 })
  const clubs = (all.data ?? []).filter((c) => c.demo_writable === true || c.is_demo === false)
  if (!clubs.length) return Response.json({ status: 'nothing-to-do', club: '-' } satisfies Summary)

  const out: (Summary | Degraded)[] = []

  for (const club of clubs) {
    try {
      const { schedule, due, now } = await loadTraining(db, club.id)
      if (!schedule.length) {
        out.push({ status: 'nothing-to-do', club: club.name })
        continue
      }

      const tonight = nightsBetween(schedule, now.date, now.date)
      const chase = nightsToChase(due, now.date)
      if (!tonight.length && !chase.length) {
        out.push({ status: 'nothing-to-do', club: club.name })
        continue
      }

      const [players, avail] = await Promise.all([
        db.from('players').select('id, name, user_id').eq('club_id', club.id).is('retired_on', null),
        db.from('current_availability').select('player_id, status').eq('club_id', club.id),
      ])
      if (players.error || avail.error) throw new Error((players.error ?? avail.error)!.message)

      let reminded = 0
      if (tonight.length) {
        const r = await pushEach(club.id, reminderItems(tonight, players.data ?? []), 'training_reminder').catch(() => null)
        reminded = r?.sent ?? 0
      }

      const asked: string[] = []
      if (chase.length) {
        const oldest = chase[chase.length - 1].date
        const checkins = await db.from('player_checkins').select('player_id, checkin_on, last_rpe').eq('club_id', club.id).gte('checkin_on', addDays(oldest, 1))
        if (checkins.error) throw new Error(checkins.error.message)
        const status = new Map((avail.data ?? []).map((a) => [a.player_id, a.status]))
        const squad = (players.data ?? []).map((p) => ({ id: p.id, name: p.name, status: status.get(p.id) ?? null }))
        for (const night of chase) {
          const draft = draftNight(night, squad, (checkins.data ?? []) as DraftCheckin[])
          await pushToClub(club.id, ['manager', 'coach'], confirmPayload(night, draft, now.date), null, 'training_confirm').catch(() => null)
          asked.push(`${night.date} ${night.startTime}`)
        }
      }

      failures = 0
      out.push({ status: 'done', club: club.name, reminded, asked })
    } catch (e) {
      failures += 1
      out.push(degrade(`${club.name}: ${(e as Error).message}`))
      if (failures >= MAX_CONSECUTIVE_FAILURES) break
    }
  }

  const degraded = out.some((r) => r.status === 'degraded')
  return Response.json({ ran_at: new Date().toISOString(), degraded, results: out }, { status: degraded ? 503 : 200 })
}
