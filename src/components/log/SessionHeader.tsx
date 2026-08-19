"use client";

import type { SessionKind } from "@/lib/types";

const KINDS: SessionKind[] = ["training", "match"];

export function SessionHeader({
  kind,
  onKindChange,
  sessionDate,
  onDateChange,
  opponent,
  onOpponentChange,
}: {
  kind: SessionKind;
  onKindChange: (kind: SessionKind) => void;
  sessionDate: string;
  onDateChange: (date: string) => void;
  opponent: string;
  onOpponentChange: (opponent: string) => void;
}) {
  return (
    <div className="px-3 pt-6 pb-4 sm:px-6">
      <p className="annot">{"// log a session"}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div
          role="group"
          aria-label="session kind"
          className="flex overflow-hidden rounded-[3px] border border-line"
        >
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={kind === k}
              onClick={() => onKindChange(k)}
              className={`pressable h-9 px-4 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
                kind === k
                  ? "bg-mint text-mint-ink"
                  : "bg-panel-2 text-ink-dim hover:text-ink"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <input
          type="date"
          aria-label="session date"
          value={sessionDate}
          onChange={(e) => onDateChange(e.target.value)}
          className="num h-9 rounded-[3px] border border-line bg-panel-2 px-3 text-sm text-ink [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
        />
        <input
          type="text"
          inputMode="text"
          placeholder="opponent (optional)"
          aria-label="opponent"
          aria-hidden={kind !== "match"}
          tabIndex={kind === "match" ? 0 : -1}
          value={opponent}
          onChange={(e) => onOpponentChange(e.target.value)}
          maxLength={60}
          className={`h-9 overflow-hidden rounded-[3px] border text-sm text-ink placeholder:text-ink-faint transition-[opacity,transform,max-width,padding] duration-200 ease-out motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
            kind === "match"
              ? "pointer-events-auto max-w-[220px] translate-y-0 border-line bg-panel-2 px-3 opacity-100"
              : "pointer-events-none max-w-0 -translate-y-1 border-transparent px-0 opacity-0"
          }`}
        />
      </div>
    </div>
  );
}
