/**
 * Two registers for health wording. `plain` suits managers and coaches;
 * `detailed` adds the figures for physios and S&C coaches. All wording lives
 * here so a change applies everywhere. Framework-free: server components,
 * client components and tests all read it.
 */
import type { HealthLanguage } from "@/lib/config";
import type { AcwrResult, WeekOnWeekResult } from "@/lib/load-engine";
import type { Readiness } from "@/lib/readiness";

export type { HealthLanguage };

const AU = (n: number) => `${Math.round(n).toLocaleString("en-GB")} AU`;

/** The ratio as a plain phrase. */
export function usualPhrase(acwr: AcwrResult): string {
  if (acwr.kind !== "ratio") return "no comparison yet";
  const r = acwr.value;
  if (r < 0.8) return "well below the usual week";
  if (r < 1.2) return "about the usual week";
  if (r < 1.5) return "above the usual week";
  return "well above the usual week";
}

export type LoadFacts = {
  sessions: number;
  weekLoad: number;
  chronicAvg: number;
  acwr: AcwrResult;
  weekChange: WeekOnWeekResult;
};

/** The footnote under the readiness word. */
export function loadLine(mode: HealthLanguage, f: LoadFacts): string {
  if (mode === "plain") {
    if (f.sessions === 0) return "nothing logged this week";
    return `${f.sessions} session${f.sessions === 1 ? "" : "s"} this week · ${usualPhrase(f.acwr)}`;
  }
  return [
    f.weekLoad > 0 ? `7-day ${AU(f.weekLoad)}` : "7-day 0 AU",
    `28-day avg ${AU(f.chronicAvg)}`,
    f.acwr.kind === "ratio" ? `ratio ${f.acwr.value.toFixed(2)}` : "ratio needs four weeks",
    f.weekChange.kind === "pct" ? `${f.weekChange.value >= 0 ? "+" : "-"}${Math.abs(f.weekChange.value * 100).toFixed(0)}% on last week` : "no last week",
  ].join(" · ");
}

/** The numbers, always, for a title attribute. */
export function loadDetail(f: LoadFacts): string {
  return loadLine("detailed", f);
}

/** The sentence under the readiness word. */
export function readinessGloss(mode: HealthLanguage, r: Readiness): string {
  if (mode === "plain") return r.gloss;
  const map: Record<Readiness["key"], string> = {
    unknown: "acute:chronic needs 28 days of sessions",
    undercooked: "acute:chronic below 0.8: detraining risk if sustained",
    steady: "acute:chronic 0.8 to 1.3: target range",
    pushing: "acute:chronic 1.3 to 1.5: reduce the next session",
    red: "acute:chronic above 1.5: elevated injury risk",
  };
  return map[r.key];
}

/** Caption under the workload chart. */
export function chartCaption(mode: HealthLanguage): string {
  return mode === "plain"
    ? "// last six weeks · one mark per session · line is the weekly total"
    : "// 42 days · marks: session load (sRPE) · lines: 7-day sum, 28-day weekly average";
}

/** Two lines under the chart saying what the shape means. */
export function chartMeaning(mode: HealthLanguage, r: Readiness, f: LoadFacts): [string, string] {
  if (mode === "plain") {
    const first = r.key === "unknown" ? "Not enough weeks logged for a reading." : `This week is ${usualPhrase(f.acwr)}.`;
    const second =
      r.key === "red"
        ? "Reduce the next training session."
        : r.key === "pushing"
          ? "Acceptable for one week. Two or more raise injury risk."
          : r.key === "undercooked"
            ? "A quiet week after a match is normal. Several in a row reduce match fitness."
            : r.key === "steady"
              ? "Keep this pattern."
              : "Log sessions for four weeks to get a reading.";
    return [first, second];
  }
  const first = f.acwr.kind === "ratio"
    ? `Acute ${AU(f.weekLoad)} against chronic ${AU(f.chronicAvg)}: ratio ${f.acwr.value.toFixed(2)}.`
    : `Acute ${AU(f.weekLoad)}; chronic average not yet valid (needs 28 days).`;
  const second = f.weekChange.kind === "pct"
    ? `Week on week ${f.weekChange.value >= 0 ? "+" : "-"}${Math.abs(f.weekChange.value * 100).toFixed(0)}%. Bands: under 0.8 low, 0.8 to 1.3 steady, 1.3 to 1.5 high, over 1.5 red.`
    : "No prior week to compare. Bands: under 0.8 low, 0.8 to 1.3 steady, 1.3 to 1.5 high, over 1.5 red.";
  return [first, second];
}

/** Column and legend words that change with the mode. */
export const WORDS: Record<HealthLanguage, { back: string; days: string; severity: string; legendClear: string; legendPast: string; legendCurrent: string; sevenDay: string; twentyEight: string }> = {
  plain: {
    back: "back",
    days: "days out",
    severity: "how bad",
    legendClear: "clear",
    legendPast: "past",
    legendCurrent: "current",
    sevenDay: "this week",
    twentyEight: "usual",
  },
  detailed: {
    back: "return",
    days: "days lost",
    severity: "severity",
    legendClear: "no history",
    legendPast: "resolved, tinted by days lost",
    legendCurrent: "unresolved",
    sevenDay: "7-day sum",
    twentyEight: "28-day weekly avg",
  },
};

export function wordFor(mode: HealthLanguage, key: keyof (typeof WORDS)["plain"]): string {
  return WORDS[mode][key];
}
