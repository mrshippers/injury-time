# Recurring training sessions and notification preferences (13 Nov 2026)

## Problem
Every training night is logged by hand: pick the date, set the kind, then enter effort and minutes for each player. The workload model, readiness words and the review all depend on that data, so it gets skipped when the week is busy and the readings go stale.

## What exists
- `sessions` (kind `training` or `match`, `minutes_planned`) and `session_loads` (rpe and minutes per player; `load` is generated). `src/lib/data.ts:433` `logSession`, `src/app/log/actions.ts`.
- `src/lib/log/suggest.ts` already opens the logger on training unless a match was played in the last three days. It does not know which days the club trains.
- The session header has a default effort that every player inherits.
- Player check-ins (`player_checkins.last_rpe`, `available`) already collect each player's own effort score, for consented players on real clubs.
- Web push: `push_subscriptions` (0013), `src/lib/push/send.ts`, `public/sw.js`, the toggle in `src/components/pwa/pwa.tsx`. `notifications.kind` already includes `training`.
- Crons are daily (`vercel.json`: 06:00, 06:15, 09:00).

## Design
1. **Schedule.** The manager sets training days on the club page: weekday, start time, length, usual effort, active from and to. A club can hold several rows (Tuesday and Thursday).
2. **Occurrences are computed, not stored.** A scheduled night with no linked `sessions` row is "due". Nothing is created speculatively, so empty sessions never reach the workload model.
3. **One-tap confirm.** /log shows each due night with a draft: players available and not injured, minutes from the schedule, effort from the player's own check-in if they sent one, otherwise the schedule's usual effort. Confirm writes the session and loads. Edit opens the normal form prefilled. Skip records a cancelled night.
4. **Nothing is invented.** Unconfirmed nights do not count toward load. This matches the rule in the chaser: absence of data is the finding.
5. **Type set automatically.** The logger opens as training on a scheduled day and as match when a fixture was played, with the date prefilled.
6. **Notification preferences.** Per person and club: training reminder (players), confirm-the-session prompt (manager and coaches), match calls, notices. Defaults on for staff prompts, off for player reminders.
7. **Daily cron.** The 09:00 job sends "Training tonight at 19:30" to opted-in players, and "Confirm last night's session: 14 players, effort 6" to staff, then stops chasing after the night is confirmed or skipped.

## Data (migration 0019)
- `training_schedule` (club_id, weekday 1-7, start_time, minutes, default_rpe, active_from, active_to).
- `sessions.schedule_id` nullable, with a unique index on (schedule_id, session_date) so a night can only be confirmed once.
- `training_skips` (schedule_id, skipped_on).
- `notification_prefs` (user_id, club_id, training_reminder, training_confirm, match_calls, notices).
- RLS as in 0018: members read, manager writes the schedule; own row only for preferences.

## Tasks
1. Migration 0019, types, local stack applied.
2. `src/lib/log/training.ts`: occurrences for a date range, draft builder, pure, with unit tests (weekday maths, active window, skips, BST/GMT, injured excluded, check-in effort used).
3. Club page "// training" section and server actions in `src/lib/club/training.ts` (manager only, demo-writable aware).
4. /log due-nights panel with confirm, edit and skip; `suggestSession` takes the schedule.
5. Preferences: table, action, panel in `pwa.tsx`, filter applied in `src/lib/push/send.ts`.
6. `/api/cron/training-reminders` (secret-guarded, degraded state like the chaser), reusing `pushEach`.
7. e2e: add a Tuesday schedule, see it due, confirm, check the squad readiness line moves. Update the pilot page copy.

## Risks
- Reminder timing is limited to the daily cron. Exact-time reminders need a cron plan with finer schedules or an external scheduler.
- Check-in effort is health data: used only where the player has consented.
- iPhone push needs the app on the home screen; the existing panel already says so.
- Migration 0019 must be applied to production before the deploy that reads it.

## Decisions needed
- Confirm in one tap (recommended), or confirm automatically after 24 hours and mark the session as auto-filled?
- Daily reminders only, or exact-time reminders with the extra infrastructure?
