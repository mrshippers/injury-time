import type { LoadFlag } from "@/lib/load-engine";

const FILL: Record<LoadFlag, string> = {
  cold: "bg-cold",
  ok: "bg-fit",
  watch: "bg-doubt",
  red: "bg-out",
};

/**
 * Thin horizontal bar scaled against the busiest player in the squad, so the
 * column reads as a relative ladder at a glance. `max` of 0 (nobody has
 * trained) renders an empty track rather than a divide-by-zero full bar.
 */
export function ConditionBar({ value, max, flag }: { value: number; max: number; flag: LoadFlag }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <span aria-hidden className="mt-[3px] block h-[3px] w-full bg-line">
      <span className={`block h-full ${FILL[flag]}`} style={{ width: `${pct}%` }} />
    </span>
  );
}
