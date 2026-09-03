/**
 * The readiness card and the season line, flat. The load word is the
 * headline, the gloss says what to do, and the ratio is a footnote for the
 * one person in the club who wants it. `insufficient_data` renders "no
 * reading" and no number at all: a fabricated 1.0 here would read as "fine".
 */
import type { AcwrResult, LoadEntry, WeekOnWeekResult } from "@/lib/load-engine";
import { READINESS_TEXT, READINESS_VAR, type Readiness } from "@/lib/readiness";
import type { SeasonStats } from "@/lib/stats";
import { NO_VALUE } from "./labels";

/** The ratio as a phrase a gaffer would say, the number itself kept for the title. */
export function usualPhrase(acwr: AcwrResult): string {
  if (acwr.kind !== "ratio") return "no comparison yet";
  const r = acwr.value;
  if (r < 0.8) return "well under his usual week";
  if (r < 1.2) return "about his usual week";
  if (r < 1.5) return "over his usual week";
  return "well over his usual week";
}

/** Sessions in the seven days ending `asOf`, inclusive. */
export function sessionsThisWeek(loads: readonly LoadEntry[], asOf: string): number {
  const end = Date.parse(`${asOf}T00:00:00Z`);
  const start = end - 6 * 86_400_000;
  return loads.filter((l) => {
    const t = Date.parse(`${l.date}T00:00:00Z`);
    return t >= start && t <= end;
  }).length;
}

function Cell({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] tracking-[0.14em] uppercase text-ink-dim">{label}</p>
      <p className={`num mt-1 text-[22px] leading-none ${dim ? "text-cold" : "text-ink"}`}>{value}</p>
    </div>
  );
}

export default function StatTiles({
  weekLoad,
  acwr,
  weekChange,
  readiness,
  stats,
  loads,
  asOf,
}: {
  weekLoad: number;
  acwr: AcwrResult;
  weekChange: WeekOnWeekResult;
  readiness: Readiness;
  stats: SeasonStats;
  loads: readonly LoadEntry[];
  asOf: string;
}) {
  const sessions = sessionsThisWeek(loads, asOf);
  const line =
    sessions === 0
      ? "nothing logged this week"
      : `${sessions} session${sessions === 1 ? "" : "s"} this week · ${usualPhrase(acwr)}`;
  // the numbers for the one person in the club who wants them
  const detail = [
    weekLoad > 0 ? `${weekLoad.toLocaleString("en-GB")} load (rpe x minutes)` : "no load",
    acwr.kind === "ratio" ? `${acwr.value.toFixed(2)}x his usual week` : "needs four weeks of sessions",
    weekChange.kind === "pct"
      ? `${weekChange.value >= 0 ? "+" : "-"}${Math.abs(weekChange.value * 100).toFixed(0)}% on last week`
      : "no last week to compare",
  ].join(" · ");

  return (
    <div className="grid grid-cols-1 gap-px bg-line lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section
        aria-labelledby="readiness-heading"
        className="relative bg-panel px-5 py-4"
        style={{ boxShadow: `inset 3px 0 0 0 ${READINESS_VAR[readiness.key]}` }}
      >
        <p className="annot" id="readiness-heading">{"// load this week"}</p>
        <p className={`display mt-3 text-[38px] leading-none ${READINESS_TEXT[readiness.key]}`}>
          {readiness.word}
        </p>
        <p className="mt-2 max-w-[36ch] text-[13px] leading-snug text-ink">{readiness.gloss}</p>
        <p className="mt-3 text-[12px] text-ink-dim" title={detail}>
          {line}
        </p>
      </section>

      <section aria-labelledby="season-heading" className="bg-panel">
        <p className="annot px-4 pt-4" id="season-heading">{"// this season"}</p>
        <div className="grid grid-cols-3 sm:grid-cols-6">
          <Cell label="apps" value={String(stats.apps)} dim={stats.apps === 0} />
          <Cell label="starts" value={String(stats.starts)} dim={stats.starts === 0} />
          <Cell label="mins" value={stats.minutes.toLocaleString("en-GB")} dim={stats.minutes === 0} />
          <Cell label="goals" value={String(stats.goals)} dim={stats.goals === 0} />
          <Cell label="assists" value={String(stats.assists)} dim={stats.assists === 0} />
          <Cell
            label="cards"
            value={stats.yellow + stats.red === 0 ? NO_VALUE : `${stats.yellow}Y${stats.red > 0 ? ` ${stats.red}R` : ""}`}
            dim={stats.yellow + stats.red === 0}
          />
        </div>
        <p className="annot px-4 pb-3 text-gold-dim">
          {stats.apps > 0 ? "from the match log" : "nothing on the match log yet"}
        </p>
      </section>
    </div>
  );
}
