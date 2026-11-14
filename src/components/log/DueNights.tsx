"use client";

/**
 * Training nights that have ended and are not logged. Each is drafted from
 * the squad list and the schedule: confirm it as it stands, change it in the
 * logger, or mark it as not held.
 */
import Link from "next/link";
import { useState, useTransition } from "react";

import { shortDate } from "@/components/squad/format";
import type { ActionState } from "@/lib/club/actions";
import { confirmNightAction, skipNightAction } from "@/lib/club/training";

export type DueCard = {
  scheduleId: string;
  date: string;
  label: string;
  line: string;
  /** efforts taken from a player's own check-in */
  fromCheckins: number;
  /** names left off the draft */
  left: string[];
  canConfirm: boolean;
};

export function DueNights({ cards }: { cards: DueCard[] }) {
  const [state, setState] = useState<ActionState>(null);
  const [pending, start] = useTransition();
  if (cards.length === 0 && !state) return null;

  return (
    <section aria-labelledby="due-h" className="mx-auto w-full max-w-[1240px] px-4 pt-5 sm:px-8">
      <p className="annot" id="due-h">{"// training to confirm"}</p>
      {cards.length > 0 ? (
        <ul className="mt-2 border-t border-line">
          {cards.map((c) => (
            <li key={`${c.scheduleId}|${c.date}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-line py-3" data-night={`${c.date}`}>
              <span className="text-[15px] font-semibold text-ink">{c.label}</span>
              <span className="num text-[12px] text-ink-dim">{shortDate(c.date)}</span>
              <span className="num text-[13px] text-ink">{c.line}</span>
              {c.fromCheckins > 0 ? <span className="text-[12.5px] text-ink-dim">{c.fromCheckins} from check-ins</span> : null}
              {c.left.length > 0 ? <span className="text-[12.5px] text-ink-dim">left off: {c.left.join(", ")}</span> : null}
              {c.canConfirm ? (
                <span className="ml-auto flex items-center gap-4">
                  <button
                    type="button"
                    disabled={pending}
                    className="pressable h-9 rounded-[2px] bg-mint px-4 text-[12px] font-bold uppercase tracking-[0.12em] text-mint-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mint"
                    onClick={() => start(async () => setState(await confirmNightAction({ scheduleId: c.scheduleId, date: c.date })))}
                  >
                    confirm
                  </button>
                  <Link href={`/log?night=${c.scheduleId}:${c.date}`} className="pressable text-[12px] font-semibold text-mint underline-offset-4 hover:underline">
                    edit
                  </Link>
                  <button
                    type="button"
                    disabled={pending}
                    className="pressable text-[12px] text-ink-dim underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
                    onClick={() => start(async () => setState(await skipNightAction({ scheduleId: c.scheduleId, date: c.date })))}
                  >
                    not held
                  </button>
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {state ? (
        <p role="status" className={`mt-3 text-[13px] ${state.ok ? "text-ink" : "text-doubt"}`}>
          <span className="num mr-2 text-[11px] tracking-[0.12em] uppercase">{state.ok ? "done" : "not done"}</span>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
