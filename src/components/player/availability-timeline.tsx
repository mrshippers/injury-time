import type { AvailabilityStatus } from "@/lib/types";
import { STATUS_META, formatDate } from "./labels";

export type AvailabilityEntry = {
  status: AvailabilityStatus;
  noted_on: string;
  return_date: string | null;
  created_at: string;
};

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
                className="flex items-baseline gap-3 py-2 border-b border-line last:border-b-0"
              >
                <span className="num text-[12px] text-ink-dim w-[72px] shrink-0">
                  {formatDate(event.noted_on)}
                </span>
                <span
                  aria-hidden
                  className="block w-2 h-2 shrink-0 translate-y-px"
                  style={{ background: meta.varName }}
                />
                <span className={`text-sm ${meta.text}`}>{meta.label}</span>
                {event.return_date ? (
                  <span className="num text-[12px] text-ink-dim ml-auto">
                    back {formatDate(event.return_date)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
