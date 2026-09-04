"use client";

/**
 * The readiness card and the season line. In plain words the load word is
 * the headline, the gloss says what to do, and the footnote is sessions and a
 * phrase; in detailed words the same card carries the ratio, the week change
 * and the load in AU. `insufficient_data` renders "no reading" and no number
 * at all: a fabricated 1.0 here would read as "fine".
 */
import { chronicWeeklyAvg, type AcwrResult, type LoadEntry, type WeekOnWeekResult } from "@/lib/load-engine";
import { loadDetail, loadLine, readinessGloss, usualPhrase, type LoadFacts } from "@/lib/health/language";
import { useHealthLanguage } from "@/lib/health/store";
import { READINESS_TEXT, READINESS_VAR, type Readiness } from "@/lib/readiness";
import type { SeasonStats } from "@/lib/stats";
import { NO_VALUE } from "./labels";

export { usualPhrase };

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
  const [mode] = useHealthLanguage();
  const facts: LoadFacts = {
    sessions: sessionsThisWeek(loads, asOf),
    weekLoad,
    chronicAvg: chronicWeeklyAvg(loads, asOf),
    acwr,
    weekChange,
  };

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
        <p className="mt-2 max-w-[40ch] text-[13px] leading-snug text-ink">{readinessGloss(mode, readiness)}</p>
        <p className={`mt-3 text-[12px] text-ink-dim ${mode === "detailed" ? "num" : ""}`} title={loadDetail(facts)} data-testid="load-line">
          {loadLine(mode, facts)}
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
