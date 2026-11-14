"use server";

import { revalidatePath } from "next/cache";

import { getRoster, logSession } from "@/lib/data";
import { addDays, draftLine, draftNight, LOOKBACK_DAYS, londonNow, nightLabel } from "@/lib/log/training";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/viewer";

import type { ActionState } from "./actions";
import { loadTraining } from "./training-data";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const refresh = () => {
  for (const p of ["/log", "/club", "/squad", "/"]) revalidatePath(p);
};

/** The manager of a real club, or anyone on the fictional demo club, sets the schedule. */
async function scheduleWriter() {
  const viewer = await getViewer();
  const demoOk = viewer.club.is_demo && viewer.club.demo_writable && !viewer.readOnly;
  if (!demoOk && (viewer.guest || viewer.role !== "manager")) return { viewer, error: "only the club's manager changes the training days" as const };
  return { viewer, error: null };
}

/** Staff who log sessions confirm and skip nights. */
async function nightWriter() {
  const viewer = await getViewer();
  if (viewer.readOnly || !viewer.can("log_session")) return { viewer, error: "only staff who log sessions can do this" as const };
  return { viewer, error: null };
}

export type ScheduleInput = { weekday: number; startTime: string; minutes: number; defaultRpe: number; startsOn?: string };

/** Add a weekly training night. */
export async function addScheduleAction(input: ScheduleInput): Promise<ActionState> {
  const { viewer, error } = await scheduleWriter();
  if (error) return { ok: false, message: error };
  const weekday = Number(input.weekday);
  const minutes = Number(input.minutes);
  const rpe = Number(input.defaultRpe);
  const time = String(input.startTime ?? "");
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return { ok: false, message: "choose a day of the week" };
  if (!TIME.test(time)) return { ok: false, message: "start time is hours and minutes, like 19:30" };
  if (!Number.isInteger(minutes) || minutes < 20 || minutes > 150) return { ok: false, message: "length is 20 to 150 minutes" };
  if (!Number.isInteger(rpe) || rpe < 1 || rpe > 10) return { ok: false, message: "usual effort is 1 to 10" };
  const today = londonNow().date;
  const startsOn = input.startsOn ? String(input.startsOn) : today;
  if (!DATE.test(startsOn) || startsOn < addDays(today, -LOOKBACK_DAYS) || startsOn > addDays(today, 365)) {
    return { ok: false, message: `start date is within the last ${LOOKBACK_DAYS} days or the next year` };
  }

  const supabase = await createClient();
  const { data: live, error: readErr } = await supabase.from("training_schedule").select("id, start_time").eq("club_id", viewer.club.id).eq("weekday", weekday).is("active_to", null);
  if (readErr) return { ok: false, message: readErr.message };
  if ((live ?? []).some((r) => String(r.start_time).slice(0, 5) === time)) return { ok: false, message: "that night is already on the schedule" };

  const { error: e } = await supabase.from("training_schedule").insert({ club_id: viewer.club.id, weekday, start_time: time, minutes, default_rpe: rpe, active_from: startsOn });
  if (e) return { ok: false, message: e.message };
  refresh();
  return { ok: true, message: "training night added" };
}

/**
 * Stop a weekly night. Sessions already confirmed keep their link, so the row
 * is ended rather than deleted, unless it never ran.
 */
export async function stopScheduleAction(id: string): Promise<ActionState> {
  const { viewer, error } = await scheduleWriter();
  if (error) return { ok: false, message: error };
  if (!UUID.test(String(id))) return { ok: false, message: "unknown training night" };
  const supabase = await createClient();
  const { data: row, error: readErr } = await supabase.from("training_schedule").select("id, active_from").eq("id", id).eq("club_id", viewer.club.id).maybeSingle();
  if (readErr) return { ok: false, message: readErr.message };
  if (!row) return { ok: false, message: "unknown training night" };
  const yesterday = addDays(londonNow().date, -1);
  const res =
    row.active_from > yesterday
      ? await supabase.from("training_schedule").delete().eq("id", id).eq("club_id", viewer.club.id)
      : await supabase.from("training_schedule").update({ active_to: yesterday }).eq("id", id).eq("club_id", viewer.club.id);
  if (res.error) return { ok: false, message: res.error.message };
  refresh();
  return { ok: true, message: "training night stopped" };
}

/**
 * Confirm a scheduled night as drafted: everyone not injured or suspended, at
 * the schedule's length, with effort from their own check-in where they sent
 * one. The night must be over, and nothing may be linked to it already.
 */
export async function confirmNightAction(input: { scheduleId: string; date: string }): Promise<ActionState> {
  const { viewer, error } = await nightWriter();
  if (error) return { ok: false, message: error };
  if (!UUID.test(String(input.scheduleId)) || !DATE.test(String(input.date))) return { ok: false, message: "unknown training night" };

  const supabase = await createClient();
  const { due } = await loadTraining(supabase, viewer.club.id);
  const night = due.find((n) => n.scheduleId === input.scheduleId && n.date === input.date);
  if (!night) return { ok: false, message: "that night is not waiting to be confirmed" };

  const [{ players }, { data: checkins }] = await Promise.all([
    getRoster(),
    supabase.from("player_checkins").select("player_id, checkin_on, last_rpe").eq("club_id", viewer.club.id).gte("checkin_on", addDays(night.date, 1)).lte("checkin_on", addDays(night.date, 2)),
  ]);
  const draft = draftNight(night, players.map((p) => ({ id: p.id, name: p.name, status: p.status })), checkins ?? []);
  if (!draft.entries.length) return { ok: false, message: "nobody is available to log; use edit" };

  try {
    await logSession({ sessionDate: night.date, kind: "training", scheduleId: night.scheduleId, minutesPlanned: night.minutes, entries: draft.entries });
  } catch (e) {
    const code = (e as { code?: string }).code;
    return { ok: false, message: code === "23505" ? "that night is already confirmed" : "could not save that session, try again" };
  }
  refresh();
  return { ok: true, message: `${nightLabel(night)} logged: ${draftLine(draft)}` };
}

/** The night did not happen. It stops being asked about and counts for nothing. */
export async function skipNightAction(input: { scheduleId: string; date: string }): Promise<ActionState> {
  const { viewer, error } = await nightWriter();
  if (error) return { ok: false, message: error };
  if (!UUID.test(String(input.scheduleId)) || !DATE.test(String(input.date))) return { ok: false, message: "unknown training night" };
  const supabase = await createClient();
  const { due } = await loadTraining(supabase, viewer.club.id);
  const night = due.find((n) => n.scheduleId === input.scheduleId && n.date === input.date);
  if (!night) return { ok: false, message: "that night is not waiting to be confirmed" };
  const { error: e } = await supabase.from("training_skips").insert({ club_id: viewer.club.id, schedule_id: night.scheduleId, skipped_on: night.date });
  if (e) return { ok: false, message: e.code === "23505" ? "that night is already skipped" : e.message };
  refresh();
  return { ok: true, message: `${nightLabel(night)} marked as not held` };
}
