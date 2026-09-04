import type { AvailabilityStatus } from "@/lib/types";
import { STATUS_META, formatDate } from "./labels";

export type AvailabilityEntry = {
  status: AvailabilityStatus;
  noted_on: string;
  return_date: string | null;
  created_at: string;
};

/** Date, status, return: one line per event at any width, nothing wraps inside a cell. */
export default function AvailabilityTimeline({
  events,
}: {
  events: AvailabilityEntry[];
}) {
  return (
    <section aria-labelledby="availability-timeline-heading">
      <p
        className="annot border-b border-line pb-2"
        id="availability-timeline-heading"
      >
        {"// availability log"}
      </p>

      {events.length === 0 ? (
        <p className="mt-4 text-sm text-ink-dim">Nothing logged yet.</p>
      ) : (
        <ol className="mt-1">
          {events.map((event, i) => {
            const meta = STATUS_META[event.status];
            return (
              <li
                key={`${event.created_at}-${i}`}
                className="grid min-h-11 grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-3 border-b border-line py-2 last:border-b-0"
              >
                <span className="num whitespace-nowrap text-[12.5px] text-ink-dim sm:text-[12px]">
                  {formatDate(event.noted_on)}
                </span>
                <span
                  aria-hidden
                  className="block h-2 w-2 shrink-0"
                  style={{ background: meta.varName }}
                />
                <span className={`truncate text-[13.5px] sm:text-sm ${meta.text}`}>{meta.label}</span>
                {event.return_date ? (
                  <span className="num whitespace-nowrap text-[12.5px] text-ink-dim sm:text-[12px]">
                    back {formatDate(event.return_date)}
                  </span>
                ) : (
                  <span />
                )}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
