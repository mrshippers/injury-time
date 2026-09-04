import { CHART } from "@/lib/tokens/charts";

/**
 * A few things compared: horizontal rungs on the 4px chip radius, ordered as
 * given, the value written at the end of each. No capsule ends, no fills
 * behind the label.
 */
export type Rung = { label: string; value: number; display?: string; tone?: "lead" | "dim" | "good" | "warn" | "bad" };

const FILL: Record<NonNullable<Rung["tone"]>, string> = {
  lead: "var(--ink)",
  dim: "var(--ink-faint)",
  good: CHART.good,
  warn: CHART.warn,
  bad: CHART.bad,
};

export function RungBars({ rungs, max, label, className = "" }: { rungs: Rung[]; max?: number; label: string; className?: string }) {
  const top = max ?? Math.max(1, ...rungs.map((r) => r.value));
  return (
    <ol className={`flex flex-col gap-2 ${className}`} aria-label={label}>
      {rungs.map((r, i) => {
        const pct = Math.max(0, Math.min(100, (r.value / top) * 100));
        return (
          <li key={r.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
            <span className="truncate text-[12.5px] text-ink">{r.label}</span>
            <span className="num text-[12.5px] font-semibold text-ink" style={{ fontVariantNumeric: "tabular-nums" }}>
              {r.display ?? r.value}
            </span>
            <span className="col-span-2 block h-[5px] rounded-[2px] bg-line">
              <span
                className="chart-pop block h-full rounded-[2px]"
                style={{ width: `${pct}%`, background: FILL[r.tone ?? "lead"], transformOrigin: "left center", animationDelay: `${i * CHART.motion.staggerBar}ms` }}
              />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
