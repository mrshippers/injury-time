/**
 * Recurring training nights. A club sets the weekdays it trains; a night is
 * "due" once it is over and nothing is linked to it. Nothing is created until
 * a person confirms it, so an unconfirmed night never counts toward load.
 * Pure and framework-free: the pages and the daily job do the reads.
 *
 * Dates are London calendar dates (YYYY-MM-DD) and times are London clock
 * times (HH:MM), so a night keeps its 19:30 across the clocks changing.
 */
import type { AvailabilityStatus } from "@/lib/types";

export type ScheduleRow = {
  id: string;
  /** ISO weekday: 1 Monday to 7 Sunday */
  weekday: number;
  /** HH:MM or HH:MM:SS */
  start_time: string;
  minutes: number;
  default_rpe: number;
  active_from: string;
  active_to: string | null;
};

export type TrainingNight = {
  scheduleId: string;
  date: string;
  weekday: number;
  /** HH:MM */
  startTime: string;
  minutes: number;
  defaultRpe: number;
};

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

/** How far back a missed night is still asked about. Older ones drop out quietly. */
export const LOOKBACK_DAYS = 7;

const DAY = 86_400_000;

export const nightKey = (scheduleId: string, date: string) => `${scheduleId}|${date}`;

export function isoWeekday(date: string): number {
  const d = new Date(`${date}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
}

const minutesOfDay = (time: string): number => {
  const [h, m] = time.split(":");
  return Number(h) * 60 + Number(m);
};

export const hhmm = (time: string): string => time.slice(0, 5);

/** The date and clock time in London at an instant. */
export function londonNow(at: Date = new Date()): { date: string; time: string } {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
  return { date, time };
}

/** Every scheduled night from `from` to `to`, both included, oldest first. */
export function nightsBetween(schedule: readonly ScheduleRow[], from: string, to: string): TrainingNight[] {
  const out: TrainingNight[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    for (const s of schedule) {
      if (s.weekday !== wd || d < s.active_from || (s.active_to !== null && d > s.active_to)) continue;
      out.push({ scheduleId: s.id, date: d, weekday: wd, startTime: hhmm(s.start_time), minutes: s.minutes, defaultRpe: s.default_rpe });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
}

/** Has the night finished? A night that runs past midnight finishes on the next date. */
export function isOver(night: TrainingNight, now: { date: string; time: string }): boolean {
  if (night.date < now.date) return true;
  if (night.date > now.date) return false;
  const end = minutesOfDay(night.startTime) + night.minutes;
  return end < 1440 && minutesOfDay(now.time) >= end;
}

/**
 * Nights that are over, not logged and not skipped, newest first, within the
 * look-back. `logged` and `skipped` hold `nightKey`s.
 */
export function dueNights(input: {
  schedule: readonly ScheduleRow[];
  now: { date: string; time: string };
  logged: ReadonlySet<string>;
  skipped: ReadonlySet<string>;
}): TrainingNight[] {
  const { schedule, now, logged, skipped } = input;
  return nightsBetween(schedule, addDays(now.date, -LOOKBACK_DAYS), now.date)
    .filter((n) => isOver(n, now))
    .filter((n) => !logged.has(nightKey(n.scheduleId, n.date)) && !skipped.has(nightKey(n.scheduleId, n.date)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime));
}

/* ── the draft ───────────────────────────────────────────────────────────── */

export type DraftPlayer = { id: string; name: string; status: AvailabilityStatus | null };
export type DraftCheckin = { player_id: string; checkin_on: string; last_rpe: number | null };

export type NightDraft = {
  entries: { playerId: string; rpe: number; minutes: number }[];
  /** left off the draft: injured or suspended */
  left: { playerId: string; name: string }[];
  /** how many efforts came from the player's own check-in rather than the schedule */
  fromCheckins: number;
};

/**
 * Who trained and how hard, as a starting point a person confirms.
 * Everyone not injured or suspended is in. Effort is the player's own
 * check-in the next day or the day after, where there is one; otherwise the
 * schedule's usual effort. A check-in only exists for a player who consented.
 */
export function draftNight(night: TrainingNight, players: readonly DraftPlayer[], checkins: readonly DraftCheckin[]): NightDraft {
  const first = addDays(night.date, 1);
  const last = addDays(night.date, 2);
  const own = new Map<string, number>();
  for (const c of [...checkins].sort((a, b) => a.checkin_on.localeCompare(b.checkin_on))) {
    if (c.last_rpe === null || c.checkin_on < first || c.checkin_on > last || own.has(c.player_id)) continue;
    own.set(c.player_id, c.last_rpe);
  }
  const entries: NightDraft["entries"] = [];
  const left: NightDraft["left"] = [];
  for (const p of players) {
    if (p.status === "injured" || p.status === "suspended") {
      left.push({ playerId: p.id, name: p.name });
      continue;
    }
    entries.push({ playerId: p.id, rpe: own.get(p.id) ?? night.defaultRpe, minutes: night.minutes });
  }
  return { entries, left, fromCheckins: entries.filter((e) => own.has(e.playerId)).length };
}

/** "14 players, effort 6": the line a confirm button and a push both show. */
export function draftLine(draft: NightDraft): string {
  const n = draft.entries.length;
  if (!n) return "nobody available";
  const effort = Math.round(draft.entries.reduce((a, e) => a + e.rpe, 0) / n);
  return `${n} player${n === 1 ? "" : "s"}, effort ${effort}`;
}

/** "Tuesday 19:30" */
export function nightLabel(night: Pick<TrainingNight, "weekday" | "startTime">): string {
  return `${WEEKDAYS[night.weekday - 1]} ${night.startTime}`;
}
