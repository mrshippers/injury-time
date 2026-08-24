import type { SquadRow } from "@/lib/data";
import type { AvailabilityStatus } from "@/lib/types";

const FILL: Record<AvailabilityStatus, string> = {
  fit: "bg-fit",
  doubt: "bg-doubt",
  injured: "bg-out",
  suspended: "bg-susp",
};

const LABEL: Record<AvailabilityStatus, string> = {
  fit: "available",
  doubt: "doubt",
  injured: "out",
  suspended: "suspended",
};

/**
 * The whole squad in one line: one block per player, in squad-number order,
 * coloured by availability. Twenty-two blocks read faster than four numbers,
 * and the numbers sit underneath for anyone who wants them anyway.
 */
export function AvailabilityStrip({
  rows,
  counts,
}: {
  rows: SquadRow[];
  counts: Record<AvailabilityStatus, number>;
}) {
  return (
    <div>
      <ul className="flex gap-[3px]" aria-label="squad availability, one block per player">
        {rows.map((r) => {
          const status = r.availability?.status ?? "fit";
          return (
            <li
              key={r.player.id}
              title={`${r.player.squad_number ?? ""} ${r.player.name}: ${LABEL[status]}`}
              className={`h-7 flex-1 rounded-[1px] ${FILL[status]} ${status === "fit" ? "opacity-80" : ""}`}
            >
              <span className="sr-only">{`${r.player.name}: ${LABEL[status]}`}</span>
            </li>
          );
        })}
      </ul>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
        {(["fit", "doubt", "injured", "suspended"] as const).map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span aria-hidden className={`block size-2 rounded-[1px] ${FILL[s]}`} />
            <span className="num text-[15px] font-semibold leading-none text-ink">{counts[s]}</span>
            <span className="text-[11.5px] leading-none text-ink-dim">{LABEL[s]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
