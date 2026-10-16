import type { AvailabilityStatus } from "@/lib/types";

const CHIPS: { status: AvailabilityStatus; label: string; dot: string }[] = [
  { status: "fit", label: "available", dot: "mark-fit" },
  { status: "doubt", label: "doubts", dot: "mark-doubt" },
  { status: "injured", label: "out", dot: "mark-out" },
  { status: "suspended", label: "suspended", dot: "mark-susp" },
];

/** Flat panels, not pills: the four numbers a gaffer wants before team talk. Marks per .mark-* in globals.css. */
export function SummaryChips({ counts }: { counts: Record<AvailabilityStatus, number> }) {
  return (
    <ul className="flex flex-wrap items-end gap-x-5 gap-y-2">
      {CHIPS.map((chip) => (
        <li
          key={chip.status}
          className="flex min-w-0 items-baseline gap-1.5"
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden className={`mark size-2.5 rounded-[1px] ${chip.dot}`} />
            <span className="num text-[22px] font-semibold leading-none text-ink tabular-nums">{counts[chip.status]}</span>
          </span>
          <span className="text-[11.5px] leading-none text-ink-dim">{chip.label}</span>
        </li>
      ))}
    </ul>
  );
}
