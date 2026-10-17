"use client";

import { useState, useTransition } from "react";

import { writeNudgeAction } from "@/lib/ai/actions";

import { CopyButton } from "./copy-button";

/** The message for the group chat, chasing whoever hasn't answered, in the gaffer's voice. Copy it, send it. */
export function Nudge({ fixtureId, names }: { fixtureId: string; names: string[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (names.length === 0) return null;
  return (
    <div className="border-b border-line px-4 py-2.5 sm:px-5">
      {msg ? (
        <div className="flex flex-col gap-2">
          <p className="text-[14px] leading-snug text-ink">{msg}</p>
          <div className="flex gap-2">
            <CopyButton text={msg} label="copy for the group" />
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="plate plate-sm num bg-panel-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">
              open whatsapp
            </a>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await writeNudgeAction(fixtureId, names);
              if (res.ok) setMsg(res.value.message);
              else setError(res.error);
            })
          }
          className="plate plate-sm pressable num bg-panel-2 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink transition-transform duration-200 hover:translate-x-0.5 disabled:opacity-60"
        >
          {pending ? "writing it" : `nudge the ${names.length} quiet ones`}
        </button>
      )}
      {error ? <p className="mt-1 text-[12px] text-doubt">{error}</p> : null}
    </div>
  );
}
