"use client";

/**
 * The club's weekly training nights, on the board. Each row is a weekday,
 * a start time, a length and the usual effort. The log screen turns every
 * night that has passed into one confirmation.
 */
import { useState, useTransition } from "react";

import type { ActionState } from "@/lib/club/actions";
import { addScheduleAction, stopScheduleAction } from "@/lib/club/training";
import { hhmm, LOOKBACK_DAYS, addDays, WEEKDAYS, type ScheduleRow } from "@/lib/log/training";

import { shortDate } from "@/components/squad/format";

const FIELD =
  "num h-10 border border-line-strong bg-panel px-2 text-[13px] text-ink [color-scheme:dark] placeholder:text-ink-faint focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint disabled:opacity-50";
const LABEL = "text-[11px] tracking-[0.12em] uppercase text-ink-dim";
const PRIMARY =
  "pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint";

export function TrainingSchedule({ schedule, allowed, reason, today }: { schedule: ScheduleRow[]; allowed: boolean; reason: string | null; today: string }) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  const live = schedule.filter((s) => s.active_to === null || s.active_to >= today);

  return (
    <div className="mt-4">
      {live.length === 0 ? (
        <p className="text-[13.5px] text-ink-dim">No training nights set.</p>
      ) : (
        <ul className="border-t border-line" aria-label="training nights">
          {live.map((s) => (
            <li key={s.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-line py-2.5 text-[14px]">
              <span className="font-semibold text-ink">{WEEKDAYS[s.weekday - 1]}</span>
              <span className="num text-ink">{hhmm(s.start_time)}</span>
              <span className="num text-[12px] text-ink-dim">{s.minutes} min</span>
              <span className="num text-[12px] text-ink-dim">effort {s.default_rpe}</span>
              {s.active_from > today ? <span className="num text-[12px] text-ink-faint">from {shortDate(s.active_from)}</span> : null}
              {s.active_to ? <span className="num text-[12px] text-ink-faint">until {shortDate(s.active_to)}</span> : null}
              {allowed ? (
                <button
                  type="button"
                  disabled={pending}
                  className="pressable ml-auto text-[12px] text-ink-dim underline-offset-4 hover:text-ink hover:underline"
                  onClick={() => start(async () => setState(await stopScheduleAction(s.id)))}
                >
                  stop
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const form = e.currentTarget;
          start(async () => {
            const res = await addScheduleAction({
              weekday: Number(f.get("weekday")),
              startTime: String(f.get("start") ?? ""),
              minutes: Number(f.get("minutes")),
              defaultRpe: Number(f.get("rpe")),
              startsOn: String(f.get("starts") ?? ""),
            });
            setState(res);
            if (res?.ok) form.reset();
          });
        }}
      >
        <fieldset disabled={!allowed || pending} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>day</span>
            <select name="weekday" aria-label="day" defaultValue="2" className={FIELD}>
              {WEEKDAYS.map((w, i) => (
                <option key={w} value={i + 1}>
                  {w}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>starts</span>
            <input name="start" aria-label="starts" type="time" defaultValue="19:30" required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>minutes</span>
            <input name="minutes" aria-label="minutes" type="number" inputMode="numeric" min={20} max={150} defaultValue={90} required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={LABEL}>usual effort</span>
            <select name="rpe" aria-label="usual effort" defaultValue="6" className={FIELD}>
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
            <span className={LABEL}>from</span>
            <input name="starts" aria-label="from" type="date" defaultValue={today} min={addDays(today, -LOOKBACK_DAYS)} className={FIELD} />
          </label>
        </fieldset>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="submit" className={PRIMARY} disabled={!allowed || pending}>
            add night
          </button>
          {!allowed && reason ? <p className="text-[13px] text-ink-dim">{reason}</p> : null}
        </div>
      </form>
      {state ? (
        <p role="status" className={`mt-3 text-[13px] ${state.ok ? "text-ink" : "text-doubt"}`}>
          <span className="num mr-2 text-[11px] tracking-[0.12em] uppercase">{state.ok ? "done" : "not done"}</span>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
