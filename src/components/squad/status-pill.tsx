import type { AvailabilityStatus } from "@/lib/types";

import { STATUS_LABEL, shortDate } from "./format";

/**
 * Compact availability chip. A rectangle with a 2px radius, never a rounded
 * pill: this is a board, not a marketing page. The word carries the meaning,
 * the tint only reinforces it.
 */
const TONE: Record<AvailabilityStatus, string> = {
  fit: "text-fit bg-fit/10 border-fit/25",
  doubt: "text-doubt bg-doubt/10 border-doubt/25",
  injured: "text-out bg-out/10 border-out/25",
  suspended: "text-susp bg-susp/10 border-susp/25",
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
        className={`num inline-flex shrink-0 items-center rounded-[2px] border px-1.5 py-[3px] text-[10.5px] font-semibold tracking-[0.09em] ${TONE[status]}`}
      >
        {STATUS_LABEL[status]}
      </span>
      {returnDate ? (
        <span className="num hidden truncate text-[11.5px] text-ink-faint sm:inline">
          back {shortDate(returnDate)}
        </span>
      ) : null}
    </span>
  );
}
