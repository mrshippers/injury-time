import { createAdminClient } from '@/lib/supabase/admin'
import { loadSeason, refreshSeason } from '@/lib/league'
import belstoneSnapshot from '../../../../../scripts/belstone-2026-27.json'
import type { Snapshot } from '@/lib/league/normalise'

/**
 * Belstone season refresh.
 *
 * Belstone is the demo club, seeded from a real club's public league feed
 * (results, fixtures, standings, appearances - see scripts/seed-belstone.ts).
 * That feed drifts every matchday: this pulls it nightly so the demo stays a
 * live-looking season instead of going stale the day it was seeded.
 *
 * It carries the same restraint as the seed: no injuries, no availability, no
 * training data invented for real people. `refreshSeason` only ever writes
 * results, fixtures, standings, progress and the season-numbers column on
 * players - nothing the club would have to actually log.
 *
 * Endings are three: done, nothing-to-do (feed had nothing new), DEGRADED.
 * A failed feed read or write must not report an empty diff as a quiet night.
 */
export const dynamic = 'force-dynamic'

const CLUB_SLUG = 'belstone'

function unauthorised() {
  return Response.json({ error: 'unauthorised' }, { status: 401 })
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  const offered = request.headers.get('authorization')
  if (!secret || offered !== `Bearer ${secret}`) return unauthorised()

  // Belstone is read-only to everyone but the server (0010), so this job writes
  // with the service role; the anon key it used before is now refused.
  const db = createAdminClient()

  const club = await db.from('clubs').select('id, name, slug, season').eq('slug', CLUB_SLUG).maybeSingle()
  if (club.error) {
    return Response.json({ status: 'degraded', reason: `clubs: ${club.error.message}` }, { status: 503 })
  }
  if (!club.data) {
    // No club yet is not drift, it is "run the seed first" - a different problem.
    return Response.json({ status: 'degraded', reason: `no club with slug ${CLUB_SLUG}; run scripts/seed-belstone.ts first` }, { status: 503 })
  }

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' }).format(new Date())

  let season
  try {
    season = await loadSeason(club.data, { snapshot: belstoneSnapshot as Snapshot, today })
  } catch (e) {
    return Response.json({ status: 'degraded', reason: `feed: ${(e as Error).message}` }, { status: 503 })
  }

  let report
  try {
    report = await refreshSeason(db, club.data, season, today)
  } catch (e) {
    return Response.json({ status: 'degraded', reason: `write: ${(e as Error).message}` }, { status: 503 })
  }

  // drift is what moved since last night, not the rows rewritten: counting rewrites
  // filed the same "10 results refreshed" notice every morning for weeks
  const drifted = report.resultsChanged.length > 0 || report.fixturesAdded > 0 || report.playersChanged.length > 0 || report.tableNew
  if (!drifted) {
    return Response.json({ status: 'nothing-to-do', club: club.data.name, ran_at: new Date().toISOString(), report })
  }

  const summary = [
    report.resultsChanged.length ? `new or changed results: ${report.resultsChanged.join('; ')}` : null,
    report.fixturesAdded ? `${report.fixturesAdded} fixture(s) added` : null,
    report.tableNew ? 'a newer league table' : null,
    report.playersChanged.length ? `apps or goals moved for ${report.playersChanged.join(', ')}` : null,
    report.unmatched.length ? `${report.unmatched.length} name(s) the feed gives that match no one, or more than one: ${report.unmatched.join(', ')}` : null,
  ].filter(Boolean).join('; ')

  // idempotency key season-refresh:belstone:{run_date}: a rerun the same day files nothing new
  const title = `Belstone season refreshed (${season.source})`
  const dup = await db.from('notifications').select('id').eq('club_id', club.data.id).eq('title', title).gte('created_at', `${today}T00:00:00Z`).limit(1)
  if (dup.error) {
    return Response.json({ status: 'degraded', reason: `notify check: ${dup.error.message}`, report }, { status: 503 })
  }
  if ((dup.data ?? []).length) {
    return Response.json({ status: 'done', already_notified: true, club: club.data.name, report })
  }

  const write = await db.from('notifications').insert({
    club_id: club.data.id,
    kind: 'notice',
    title,
    body: summary,
    audience: ['manager', 'coach'],
  })
  if (write.error) {
    // The refresh landed, only the filing failed - still degraded, the drift
    // would otherwise go unread.
    return Response.json({ status: 'degraded', reason: `notify: ${write.error.message}`, report }, { status: 503 })
  }

  return Response.json({ status: 'done', club: club.data.name, ran_at: new Date().toISOString(), report })
}
