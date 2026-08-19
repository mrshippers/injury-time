import type { AvailabilityStatus } from "@/lib/types";

const CHIPS: { status: AvailabilityStatus; label: string; dot: string }[] = [
  { status: "fit", label: "available", dot: "bg-fit" },
  { status: "doubt", label: "doubts", dot: "bg-doubt" },
  { status: "injured", label: "out", dot: "bg-out" },
  { status: "suspended", label: "suspended", dot: "bg-susp" },
];

/** Flat panels, not pills: the four numbers a gaffer wants before team talk. */
export function SummaryChips({ counts }: { counts: Record<AvailabilityStatus, number> }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {CHIPS.map((chip) => (
        <li
          key={chip.status}
          className="flex min-w-[92px] items-center gap-2 rounded-[2px] border border-line bg-panel px-3 py-2"
        >
          <span aria-hidden className={`block size-2 rounded-[1px] ${chip.dot}`} />
          <span className="num text-[17px] font-semibold leading-none text-ink">
            {counts[chip.status]}
          </span>
          <span className="text-[11.5px] leading-none text-ink-dim">{chip.label}</span>
        </li>
      ))}
    </ul>
  );
}
