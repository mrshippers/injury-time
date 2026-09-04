/**
 * The two ways the app talks about a body. `plain` is what a gaffer says on
 * the touchline; `detailed` is what the physio or S&C coach wants to see
 * underneath it. Every word lives here so a change lands everywhere at once.
 * Framework-free: server components, client components and tests all read it.
 */
import type { HealthLanguage } from "@/lib/config";
import type { AcwrResult, WeekOnWeekResult } from "@/lib/load-engine";
import type { Readiness } from "@/lib/readiness";

export type { HealthLanguage };

const AU = (n: number) => `${Math.round(n).toLocaleString("en-GB")} AU`;

/** The ratio as a phrase a gaffer would say. */
export function usualPhrase(acwr: AcwrResult): string {
  if (acwr.kind !== "ratio") return "no comparison yet";
  const r = acwr.value;
  if (r < 0.8) return "well under his usual week";
  if (r < 1.2) return "about his usual week";
  if (r < 1.5) return "over his usual week";
  return "well over his usual week";
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
    unknown: "acute:chronic needs 28 days of sessions; nothing is inferred until then",
    undercooked: "acute load under 0.8 of the chronic average: detraining risk if it holds",
    steady: "acute load within 0.8 to 1.3 of the chronic average: the sweet spot",
    pushing: "acute load 1.3 to 1.5 of the chronic average: taper the next session",
    red: "acute load above 1.5 of the chronic average: the injury-risk band",
  };
  return map[r.key];
}

/** Caption under the load chart. */
export function chartCaption(mode: HealthLanguage): string {
  return mode === "plain"
    ? "// last six weeks · a mark per session · the line is his week"
    : "// 42 days · marks are session load (sRPE) · lines are the 7-day sum and the 28-day weekly average";
}

/** Two lines under the chart saying what the shape means. */
export function chartMeaning(mode: HealthLanguage, r: Readiness, f: LoadFacts): [string, string] {
  if (mode === "plain") {
    const first = r.key === "unknown" ? "Not enough weeks logged to read him yet." : `This week is ${usualPhrase(f.acwr)}.`;
    const second =
      r.key === "red"
        ? "Ease him off on the next training night rather than the one after."
        : r.key === "pushing"
          ? "Fine if it is a one-off; two weeks of this and he is a risk."
          : r.key === "undercooked"
            ? "A quiet week is fine after a match; three in a row and sharpness goes."
            : r.key === "steady"
              ? "Keep the weeks looking like this and he stays available."
              : "Log Tuesday and Thursday and the line starts to mean something.";
    return [first, second];
  }
  const first = f.acwr.kind === "ratio"
    ? `Acute ${AU(f.weekLoad)} against chronic ${AU(f.chronicAvg)}: ratio ${f.acwr.value.toFixed(2)}.`
    : `Acute ${AU(f.weekLoad)}; chronic average not yet valid (needs 28 days).`;
  const second = f.weekChange.kind === "pct"
    ? `Week on week ${f.weekChange.value >= 0 ? "+" : "-"}${Math.abs(f.weekChange.value * 100).toFixed(0)}%. Bands: under 0.8 undercooked, 0.8 to 1.3 steady, 1.3 to 1.5 pushing, over 1.5 red.`
    : "No prior week to compare. Bands: under 0.8 undercooked, 0.8 to 1.3 steady, 1.3 to 1.5 pushing, over 1.5 red.";
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
    sevenDay: "his week",
    twentyEight: "his usual",
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
