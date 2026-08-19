/**
 * Three numbers, flat. `insufficient_data` renders an em dash in the cold
 * colour and nothing else: there is no sentinel ratio, because a fabricated
 * 1.0 in this row would read as "he's fine".
 */
import type { AcwrResult, LoadFlag, WeekOnWeekResult } from "@/lib/load-engine";
import { NO_VALUE } from "./labels";

const FLAG_TEXT: Record<LoadFlag, string> = {
  ok: "text-fit",
  watch: "text-doubt",
  red: "text-out",
  cold: "text-cold",
};

function Tile({
  label,
  value,
  valueClass,
  note,
}: {
  label: string;
  value: string;
  valueClass?: string;
  note?: string;
}) {
  return (
    <div className="border border-line bg-panel px-5 py-4">
      <p className="annot">{`// ${label}`}</p>
      <p className={`num mt-3 text-4xl leading-none ${valueClass ?? "text-ink"}`}>
        {value}
      </p>
      <p className="mt-2 text-[11px] text-ink-dim tracking-wide h-4">
        {note ?? ""}
      </p>
    </div>
  );
}

export default function StatTiles({
  weekLoad,
  acwr,
  weekChange,
  flag,
}: {
  weekLoad: number;
  acwr: AcwrResult;
  weekChange: WeekOnWeekResult;
  flag: LoadFlag;
}) {
  const acwrValue = acwr.kind === "ratio" ? acwr.value.toFixed(2) : NO_VALUE;
  const acwrClass = acwr.kind === "ratio" ? FLAG_TEXT[flag] : "text-cold";
  const acwrNote =
    acwr.kind === "ratio" ? "acute ÷ 4-week average" : "needs 28 days of history";

  const pct =
    weekChange.kind === "pct"
      ? `${weekChange.value >= 0 ? "+" : "−"}${Math.abs(weekChange.value * 100).toFixed(1)}%`
      : NO_VALUE;
  const pctClass = weekChange.kind === "pct" ? "text-ink" : "text-cold";
  const pctNote =
    weekChange.kind === "pct" ? "vs the week before" : "no prior week to compare";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line">
      <Tile
        label="7-day load"
        value={weekLoad > 0 ? weekLoad.toLocaleString("en-GB") : "0"}
        note="AU · sRPE"
      />
      <Tile
        label="acwr"
        value={acwrValue}
        valueClass={acwrClass}
        note={acwrNote}
      />
      <Tile
        label="Δ week"
        value={pct}
        valueClass={pctClass}
        note={pctNote}
      />
    </div>
  );
}
