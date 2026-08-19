import type { AvailabilityStatus } from "@/lib/types";

import { STATUS_LABEL, shortDate } from "./format";

/**
 * Compact availability chip. A rectangle with a 2px radius, never a rounded
 * pill: this is a board, not a marketing page. The word carries the meaning,
 * the tint only reinforces it.
 */
const TONE: Record<AvailabilityStatus, string> = {
  fit: "text-fit border-fit/35",
  doubt: "text-doubt border-doubt/35",
  injured: "text-out border-out/40",
  suspended: "text-susp border-susp/35",
};

export function StatusPill({
  status,
  returnDate,
}: {
  status: AvailabilityStatus;
  returnDate?: string | null;
}) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      <span
        className={`num inline-flex shrink-0 items-center rounded-[2px] border bg-pitch px-1.5 py-[3px] text-[10.5px] font-semibold tracking-[0.09em] ${TONE[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
      {returnDate ? (
        <span className="num hidden truncate text-[11.5px] text-ink-dim sm:inline">
          back {shortDate(returnDate)}
        </span>
      ) : null}
    </span>
  );
}
