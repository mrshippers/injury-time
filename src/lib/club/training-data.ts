/**
 * The reads behind recurring training: the club's schedule and which nights
 * are due. Takes a client so a page (RLS) and the daily job (service role)
 * share one definition of "due".
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { addDays, dueNights, LOOKBACK_DAYS, londonNow, nightKey, type ScheduleRow, type TrainingNight } from "@/lib/log/training";
import type { Database } from "@/lib/types";

export type TrainingState = { schedule: ScheduleRow[]; due: TrainingNight[]; now: { date: string; time: string } };

export async function loadTraining(db: SupabaseClient<Database>, clubId: string, now = londonNow()): Promise<TrainingState> {
  const since = addDays(now.date, -LOOKBACK_DAYS);
  const [sched, sessions, skips] = await Promise.all([
    db.from("training_schedule").select("*").eq("club_id", clubId).order("weekday").order("start_time"),
    // any training session on the date covers the night, however it was logged
    db.from("sessions").select("session_date").eq("club_id", clubId).eq("kind", "training").gte("session_date", since),
    db.from("training_skips").select("schedule_id, skipped_on").eq("club_id", clubId).gte("skipped_on", since),
  ]);
  const err = sched.error ?? sessions.error ?? skips.error;
  if (err) throw err;
  const schedule = (sched.data ?? []) as ScheduleRow[];
  const trainedOn = new Set((sessions.data ?? []).map((s) => s.session_date as string));
  const logged = new Set<string>();
  for (const s of schedule) for (const d of trainedOn) logged.add(nightKey(s.id, d));
  const skipped = new Set((skips.data ?? []).map((k) => nightKey(k.schedule_id as string, k.skipped_on as string)));
  return { schedule, due: dueNights({ schedule, now, logged, skipped }), now };
}
