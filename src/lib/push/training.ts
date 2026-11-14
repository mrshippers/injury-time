/**
 * The words of the two training pushes. Pure, so the daily job and the tests
 * share them: a reminder for players before a night, a prompt for staff to
 * confirm it afterwards.
 */
import { addDays, draftLine, WEEKDAYS, type NightDraft, type TrainingNight } from "@/lib/log/training";

import type { PushPayload } from "./send";

export function reminderPayload(night: TrainingNight): PushPayload {
  return { title: `Training tonight at ${night.startTime}`, body: `${night.minutes} minutes`, url: "/team", tag: `training:${night.scheduleId}:${night.date}` };
}

/** One reminder per player with an account, however many nights are on today. */
export function reminderItems(nights: readonly TrainingNight[], players: readonly { user_id: string | null }[]): { userId: string; payload: PushPayload }[] {
  const first = [...nights].sort((a, b) => a.startTime.localeCompare(b.startTime))[0];
  if (!first) return [];
  const users = [...new Set(players.map((p) => p.user_id).filter((u): u is string => Boolean(u)))];
  return users.map((userId) => ({ userId, payload: reminderPayload(first) }));
}

export function confirmPayload(night: TrainingNight, draft: NightDraft, today: string): PushPayload {
  const when = night.date === addDays(today, -1) ? "last night's" : `${WEEKDAYS[night.weekday - 1]}'s`;
  return { title: `Confirm ${when} session`, body: draftLine(draft), url: "/log", tag: `confirm:${night.scheduleId}:${night.date}` };
}

/** Staff are asked the morning after and for two days more; after that the night waits quietly on the log screen. */
export const CHASE_DAYS = 3;

export function nightsToChase(due: readonly TrainingNight[], today: string): TrainingNight[] {
  const oldest = addDays(today, -CHASE_DAYS);
  return due.filter((n) => n.date >= oldest);
}
