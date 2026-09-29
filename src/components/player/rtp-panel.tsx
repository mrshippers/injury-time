"use client";

/**
 * Return to play for the current injury. The physio lays out the ladder to a
 * date and ticks stages off; the manager reads "stage 3 of 7, ready 8 Oct".
 * Shape carries the state (solid done, hollow to do, struck through overdue).
 */
import { useState, useTransition } from "react";

import { STAGE_WORD, rtpStatus } from "@/lib/health/rtp";
import { setRtpPlanAction, tickRtpStepAction } from "@/lib/health/rtp-actions";
import { useHealthLanguage } from "@/lib/health/store";
import type { Injury, RtpStep } from "@/lib/types";

import { formatDate } from "./labels";

export default function RtpPanel({ injury, steps, asOf, canEdit }: { injury: Injury; steps: RtpStep[]; asOf: string; canEdit: boolean }) {
  const [mode] = useHealthLanguage();
  const [returnOn, setReturnOn] = useState(injury.expected_return ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const status = rtpStatus(steps, asOf);
  const sorted = [...steps].sort((a, b) => a.target_date.localeCompare(b.target_date));

  const plan = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await setRtpPlanAction(injury.id, returnOn);
      if (!r.ok) setError(r.error);
    });
  };

  return (
    <section aria-labelledby="rtp-heading">
      <p className="annot border-b border-line pb-2" id="rtp-heading">{"// return to play"}</p>

      {steps.length ? (
        <>
          <p className="mt-3 text-[15px] text-ink">
            <span className="font-semibold">
              stage {Math.min(status.done + 1, status.total)} of {status.total}
            </span>
            {status.readyOn ? <span className="text-ink-dim"> · ready for a game {formatDate(status.readyOn)}</span> : null}
            {status.behind ? <span className="num ml-2 text-[11px] uppercase tracking-[0.1em] text-doubt">behind plan</span> : null}
          </p>
          <ol className="mt-3 flex flex-col">
            {sorted.map((s) => {
              const late = !s.done_on && s.target_date < asOf;
              return (
                <li key={s.id} className="flex items-center gap-3 border-b border-line py-2.5">
                  <span aria-hidden className={`mark size-3 shrink-0 rounded-[1px] ${s.done_on ? "mark-fit" : late ? "mark-out" : "mark-cold"}`} />
                  <span className={`flex-1 text-[14px] ${s.done_on ? "text-ink-dim" : "text-ink"}`}>{STAGE_WORD[s.stage][mode]}</span>
                  <span className="num text-[12px] text-ink-dim">{s.done_on ? `done ${formatDate(s.done_on)}` : formatDate(s.target_date)}</span>
                  {canEdit ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => start(async () => void (await tickRtpStepAction(s.id, !s.done_on)))}
                      className="pressable h-9 min-w-16 rounded-[2px] border border-line-strong px-2 text-[11px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-50"
                      aria-label={`${s.done_on ? "untick" : "tick"} ${STAGE_WORD[s.stage].plain}`}
                    >
                      {s.done_on ? "undo" : "done"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="mt-3 text-[14px] text-ink-dim">
          No plan yet. {canEdit ? "Pick the date he should be ready for a game and the stages lay themselves out." : "The physio sets one."}
        </p>
      )}

      {canEdit ? (
        <form onSubmit={plan} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[0.12em] text-ink-dim">ready for a game on</span>
            <input
              type="date"
              min={asOf}
              value={returnOn}
              onChange={(e) => setReturnOn(e.target.value)}
              className="num h-10 border border-line-strong bg-panel px-2 text-[13px] text-ink [color-scheme:dark]"
            />
          </label>
          <button type="submit" disabled={pending || !returnOn} className="pressable h-10 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-50">
            {steps.length ? "re-plan" : "plan the return"}
          </button>
          {error ? <p role="alert" className="w-full text-[13px] text-doubt">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
