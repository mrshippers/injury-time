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
    <ul className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
      {CHIPS.map((chip) => (
        <li
          key={chip.status}
          className="flex min-w-0 flex-col items-start gap-1.5 rounded-[2px] border border-line bg-panel px-2.5 py-2 sm:min-w-[92px] sm:flex-row sm:items-center sm:gap-2 sm:px-3"
        >
          <span className="flex items-center gap-1.5">
            <span aria-hidden className={`mark size-2.5 rounded-[1px] ${chip.dot}`} />
            <span className="num text-[17px] font-semibold leading-none text-ink">{counts[chip.status]}</span>
          </span>
          <span className="text-[11.5px] leading-none text-ink-dim">{chip.label}</span>
        </li>
      ))}
    </ul>
  );
}
