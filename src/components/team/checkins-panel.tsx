"use client";

/**
 * Staff side of check-ins: who answered today, and each player's private link
 * to send where the squad already talks. On a demo club it says why there are
 * none: a public demo never takes health data from anyone.
 */
import { useState, useTransition } from "react";

import { checkinLinkAction } from "@/lib/checkin/actions";
import type { PlayerCheckin } from "@/lib/types";

type P = { id: string; name: string; number: number | null };

export function CheckinsPanel({ players, today, isDemo, canSend }: { players: P[]; today: PlayerCheckin[]; isDemo: boolean; canSend: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const by = new Map(today.map((c) => [c.player_id, c]));

  const copy = (id: string) =>
    start(async () => {
      setError(null);
      const r = await checkinLinkAction(id);
      if (!r.ok) return setError(r.error);
      try {
        await navigator.clipboard.writeText(r.url);
        setCopied(id);
      } catch {
        setError(`copy failed; the link is ${r.url}`);
      }
    });

  return (
    <section aria-labelledby="checkins-h" className="bg-panel border border-line px-4 py-4 sm:px-5">
      <p className="annot" id="checkins-h">{"// check-ins today"}</p>
      {isDemo ? (
        <p className="mt-2 text-[13.5px] leading-snug text-ink-dim">
          Players check in from a private link: how sore, how hard the last session felt, available or not. A public demo never takes health data from anyone, so there are none here. On your own club each player gets a link to send.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] text-ink-dim">
            <span className="num text-ink">{today.length}</span> of {players.length} answered
          </p>
          <ul className="mt-3 flex flex-col">
            {players.map((p) => {
              const c = by.get(p.id);
              return (
                <li key={p.id} className="flex items-center gap-3 border-b border-line py-2 text-[14px]">
                  <span className="min-w-0 flex-1 truncate text-ink">{p.name}</span>
                  {c ? (
                    <span className="num text-[12px] text-ink-dim">
                      sore {c.soreness} · {c.last_rpe ? `rpe ${c.last_rpe} · ` : ""}
                      <span className={c.available === "yes" ? "text-ink" : "text-doubt"}>{c.available === "yes" ? "available" : c.available === "no" ? "not available" : "unsure"}</span>
                    </span>
                  ) : (
                    <span className="num text-[12px] text-ink-faint">no answer</span>
                  )}
                  {canSend ? (
                    <button type="button" disabled={pending} onClick={() => copy(p.id)} className="pressable h-9 rounded-[2px] border border-line-strong px-2 text-[11px] uppercase tracking-[0.1em] text-ink-dim hover:text-ink disabled:opacity-50">
                      {copied === p.id ? "copied" : "copy link"}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          {error ? <p role="alert" className="mt-2 text-[13px] text-doubt">{error}</p> : null}
        </>
      )}
    </section>
  );
}
