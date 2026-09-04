"use client";

import type { SessionKind } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  })
    .format(d)
    .toLowerCase();
}

export function StickyBar({
  loggedCount,
  totalCount,
  kind,
  sessionDate,
  isPending,
  onSave,
}: {
  loggedCount: number;
  totalCount: number;
  kind: SessionKind;
  sessionDate: string;
  isPending: boolean;
  onSave: () => void;
}) {
  const disabled = loggedCount < 1 || isPending;
  return (
    <div className="fixed inset-x-0 z-20 flex items-center justify-between gap-3 border-t border-line-strong bg-panel-2/90 px-3 py-3 backdrop-blur max-sm:bottom-[calc(56px+env(safe-area-inset-bottom))] sm:bottom-0 sm:px-6 sm:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <p className="num text-sm text-ink-dim">
        <span className="font-semibold text-ink">{loggedCount}</span> of{" "}
        {totalCount} logged
        <span className="text-ink-dim">
          {" · "}
          {kind}
          {" · "}
          {formatDate(sessionDate)}
        </span>
      </p>
      <button
        type="button"
        onClick={onSave}
        disabled={disabled}
        className="pressable h-11 shrink-0 rounded-[3px] bg-mint px-5 text-sm font-bold text-mint-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:pointer-events-none disabled:opacity-35 sm:h-10"
      >
        {isPending ? "saving…" : "save session"}
      </button>
    </div>
  );
}
