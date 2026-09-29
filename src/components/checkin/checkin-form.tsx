"use client";

import { useState, useTransition } from "react";

import { submitCheckinAction, withdrawCheckinsAction, type CheckinState } from "@/lib/checkin/actions";
import type { CheckinAvailable } from "@/lib/types";

const CHIP = (on: boolean) =>
  `pressable h-11 min-w-11 rounded-[2px] border px-2 text-[14px] num ${on ? "border-mint bg-panel-2 text-ink" : "border-line bg-panel text-ink-dim"}`;

export function CheckinForm({ token, clubName, consented, todayDone }: { token: string; clubName: string; consented: boolean; todayDone: boolean }) {
  const [agree, setAgree] = useState(false);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [rpe, setRpe] = useState<number | null>(null);
  const [available, setAvailable] = useState<CheckinAvailable | null>(null);
  const [state, setState] = useState<CheckinState>(null);
  const [pending, start] = useTransition();
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);

  return (
    <div className="mt-6">
      {!consented ? (
        <section aria-labelledby="consent-h" className="border border-line bg-panel px-4 py-4">
          <p className="annot" id="consent-h">{"// before the first one"}</p>
          <ul className="mt-3 flex flex-col gap-2 text-[14px] leading-relaxed text-ink-dim">
            <li><span className="text-ink">What:</span> how sore you are (0 to 10), how hard your last session felt (1 to 10), and whether you are available. Nothing else, no free text.</li>
            <li><span className="text-ink">Who sees it:</span> {clubName}&apos;s manager, coaches and physio. Not other players.</li>
            <li><span className="text-ink">Why:</span> so training load is planned around how you actually are.</li>
            <li><span className="text-ink">Stop any time:</span> the button at the bottom of this page deletes everything you have sent.</li>
          </ul>
          <label className="mt-4 flex items-start gap-3 text-[14px] text-ink">
            <input type="checkbox" className="mt-1 size-5 accent-[var(--mint)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            I agree to {clubName} holding these check-ins about my fitness for the reasons above.
          </label>
        </section>
      ) : todayDone ? (
        <p className="text-[14px] text-ink-dim">You checked in today. Send again to change it.</p>
      ) : null}

      <form
        className="mt-6 flex flex-col gap-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (soreness === null || available === null) return setState({ ok: false, message: "answer the two questions first" });
          start(async () => setState(await submitCheckinAction({ token, consent: consented || agree, soreness, lastRpe: rpe, available })));
        }}
      >
        <fieldset>
          <legend className="text-[15px] font-semibold text-ink">How sore are you? <span className="font-normal text-ink-dim">0 is fine, 10 is can&apos;t move</span></legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Array.from({ length: 11 }, (_, n) => (
              <button key={n} type="button" aria-pressed={soreness === n} className={CHIP(soreness === n)} onClick={() => setSoreness(n)}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[15px] font-semibold text-ink">How hard did the last session feel? <span className="font-normal text-ink-dim">optional</span></legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" aria-pressed={rpe === n} className={CHIP(rpe === n)} onClick={() => setRpe(rpe === n ? null : n)}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-[15px] font-semibold text-ink">Available for the next game?</legend>
          <div className="mt-2 flex gap-1.5">
            {(["yes", "unsure", "no"] as const).map((a) => (
              <button key={a} type="button" aria-pressed={available === a} className={`${CHIP(available === a)} flex-1`} onClick={() => setAvailable(a)}>
                {a}
              </button>
            ))}
          </div>
        </fieldset>
        <button
          type="submit"
          disabled={pending || (!consented && !agree)}
          className="pressable h-12 rounded-[2px] bg-mint text-[13px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-40"
        >
          {pending ? "sending" : "send"}
        </button>
      </form>

      {state ? (
        <p role="status" className={`mt-4 text-[14px] ${state.ok ? "text-ink" : "text-doubt"}`}>
          {state.message}
        </p>
      ) : null}

      {consented ? (
        <div className="mt-12 border-t border-line pt-5">
          {!confirmWithdraw ? (
            <button type="button" onClick={() => setConfirmWithdraw(true)} className="pressable h-10 text-[13px] text-ink-dim underline underline-offset-4 hover:text-ink">
              stop check-ins and delete everything I have sent
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[14px] text-ink">Delete all your check-ins?</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => start(async () => setState(await withdrawCheckinsAction(token)))}
                className="pressable h-10 rounded-[2px] border border-out px-3 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink"
              >
                yes, delete
              </button>
              <button type="button" onClick={() => setConfirmWithdraw(false)} className="pressable h-10 px-3 text-[12px] uppercase tracking-[0.1em] text-ink-dim">
                keep them
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
