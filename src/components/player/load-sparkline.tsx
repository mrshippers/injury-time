"use client";

/**
 * Six weeks of load on the lieflat grammar: a hairline for his week (the
 * 7-day sum), a mark per session in a barcode row along the floor, a ledger
 * grid with no axis lines, the real reading written at the end of the line,
 * and ONE annotation in gold at the point that matters. In detailed words the
 * 28-day weekly average joins it, named. Days with no session are drawn as
 * nothing at all, never a zero the eye reads as "a light session".
 */
import { useSyncExternalStore } from "react";

import { chartCaption, chartMeaning, type LoadFacts } from "@/lib/health/language";
import { useHealthLanguage } from "@/lib/health/store";
import { chronicWeeklyAvg, type AcwrResult, type LoadEntry, type LoadFlag, type WeekOnWeekResult } from "@/lib/load-engine";
import type { Readiness } from "@/lib/readiness";
import { CHART } from "@/lib/tokens/charts";
import type { Injury } from "@/lib/types";

import { REGION_LABEL } from "./labels";

const DAYS = 42;
const BARCODE_H = 16;

/** The drawing's frame: wide on a desk, a squarer, larger-type frame on a phone. */
function frame(narrow: boolean) {
  const W = narrow ? 560 : 900;
  const H = narrow ? 230 : 190;
  const PAD_T = narrow ? 40 : 30;
  const PAD_L = 6;
  const PAD_R = narrow ? 96 : 118;
  const PAD_B = 24 + BARCODE_H;
  const PLOT_W = W - PAD_L - PAD_R;
  return { W, H, PAD_T, PAD_L, PAD_R, PAD_B, PLOT_W, STEP: PLOT_W / DAYS, PLOT_H: H - PAD_T - PAD_B, type: narrow ? 1.25 : 1 };
}

const NARROW = "(max-width: 640px)";
function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
function useNarrow(): boolean {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW).matches, () => false);
}

function shiftISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayIndex(iso: string, asOf: string): number {
  return Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${asOf}T00:00:00Z`)) / 86_400_000) + (DAYS - 1);
}

/** Quadratic-midpoint smoothing: rounded joins without a spline library. */
function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0][0].toFixed(1)},${points[0][1].toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    d += `Q${x0.toFixed(1)},${y0.toFixed(1)} ${((x0 + x1) / 2).toFixed(1)},${((y0 + y1) / 2).toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return `${d}L${last[0].toFixed(1)},${last[1].toFixed(1)}`;
}

type Note = { i: number; text: string; tone: "gold" | "bad" };

/** The one thing worth writing on the drawing. */
function pickAnnotation(injuries: Injury[], asOf: string, acute: number[], sessions: number): Note | null {
  const inWindow = injuries
    .map((inj) => ({ inj, i: dayIndex(inj.occurred_on, asOf) }))
    .filter((x) => x.i >= 0 && x.i < DAYS)
    .sort((a, b) => b.i - a.i);
  if (inWindow.length > 0) {
    const { inj, i } = inWindow[0];
    return { i, text: `the week his ${REGION_LABEL[inj.body_region]} went`, tone: "bad" };
  }
  if (sessions === 0) return null;
  let best = -1;
  let bestJump = 0;
  for (let i = 13; i < DAYS; i += 1) {
    const jump = acute[i] - acute[i - 7];
    if (jump > bestJump) {
      bestJump = jump;
      best = i;
    }
  }
  if (best < 0 || bestJump <= 0) return null;
  return { i: best, text: "biggest jump of the six weeks", tone: "gold" };
}

export default function LoadSparkline({
  loads,
  asOf,
  flag,
  readiness,
  acwr,
  weekChange,
  injuries,
}: {
  loads: LoadEntry[];
  asOf: string;
  flag: LoadFlag;
  readiness: Readiness;
  acwr: AcwrResult;
  weekChange: WeekOnWeekResult;
  injuries: Injury[];
}) {
  const [mode] = useHealthLanguage();
  const narrow = useNarrow();
  const { W, H, PAD_T, PAD_L, PLOT_W, STEP, PLOT_H, type } = frame(narrow);
  const tickSize = CHART.tick.size * type;
  const readingSize = CHART.reading.size * type;

  // several sessions can land on one day; the day is what the chart plots
  const byDate = new Map<string, number>();
  for (const entry of loads) byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.load);
  const daily: number[] = [];
  for (let i = 0; i < DAYS; i += 1) daily.push(byDate.get(shiftISO(asOf, i - (DAYS - 1))) ?? 0);
  const maxDaily = Math.max(...daily, 1);
  const sessionsInWindow = daily.filter((v) => v > 0).length;

  // 7-day rolling sum from day 7; 28-day weekly average from day 28
  const acute: number[] = daily.map((_, i) => (i < 6 ? 0 : daily.slice(i - 6, i + 1).reduce((t, v) => t + v, 0)));
  const chronic: number[] = daily.map((_, i) => (i < 27 ? 0 : (acute[i] + acute[i - 7] + acute[i - 14] + acute[i - 21]) / 4));
  const showChronic = mode === "detailed";
  const maxY = Math.max(...acute.slice(6), ...(showChronic ? chronic.slice(27) : []), 1);

  const x = (i: number) => PAD_L + i * STEP + STEP / 2;
  const y = (v: number) => PAD_T + PLOT_H - (v / maxY) * PLOT_H;
  const baseline = PAD_T + PLOT_H;
  const acutePts = acute.map((v, i) => [x(i), y(v)] as const).slice(6);
  const chronicPts = chronic.map((v, i) => [x(i), y(v)] as const).slice(27);
  const todayX = x(DAYS - 1);
  const bandX = x(DAYS - 7) - STEP / 2;

  const note = pickAnnotation(injuries, asOf, acute, sessionsInWindow);
  const noteX = note ? x(note.i) : 0;
  const noteOnLine = note ? note.i >= 6 : false;
  const noteY = note ? (noteOnLine ? y(acute[note.i]) : baseline) : 0;
  const noteRight = note ? noteX > PAD_L + PLOT_W * 0.55 : false;

  const facts: LoadFacts = {
    sessions: daily.slice(DAYS - 7).filter((v) => v > 0).length,
    weekLoad: acute[DAYS - 1],
    chronicAvg: chronicWeeklyAvg(loads, asOf),
    acwr,
    weekChange,
  };
  const [meaningA, meaningB] = chartMeaning(mode, readiness, facts);
  const endAcute = Math.round(acute[DAYS - 1]);
  const endChronic = Math.round(chronic[DAYS - 1]);
  // two readings at the right edge must not sit on each other: the chronic
  // label steps away from the acute one when the lines end close together
  const acuteY = y(acute[DAYS - 1]);
  let chronicLabelY = y(chronic[DAYS - 1]);
  if (showChronic && Math.abs(chronicLabelY - acuteY) < 30) chronicLabelY = chronicLabelY >= acuteY ? acuteY + 30 : acuteY - 30;
  const ticks = [0.25, 0.5, 0.75, 1].map((f) => ({ f, v: Math.round(maxY * f) }));
  const mono = { fontFamily: CHART.tick.family } as const;

  return (
    <figure className="border border-line bg-panel p-4" data-testid="load-chart" data-mode={mode}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`Session load over the last 42 days with the seven-day rolling sum${showChronic ? " and the 28-day weekly average" : ""}. This week ${endAcute} AU.${note ? ` Annotation: ${note.text}.` : ""}`}
      >
        {/* the red-zone band, only when the flag says so */}
        {flag === "red" ? (
          <rect x={bandX} y={PAD_T - 6} width={todayX + STEP / 2 - bandX} height={PLOT_H + 6} fill="var(--out)" fillOpacity={0.08} />
        ) : null}

        {/* ledger grid: hairlines, no axis line */}
        {ticks.map((t) => (
          <g key={t.f}>
            <line x1={PAD_L} y1={y(t.v)} x2={PAD_L + PLOT_W} y2={y(t.v)} stroke={CHART.grid} strokeWidth={1} />
            {showChronic ? (
              <text x={PAD_L + 2} y={y(t.v) - 3} fontSize={tickSize} letterSpacing={1.2} fill="var(--ink-faint)" style={mono}>
                {t.v.toLocaleString("en-GB")}
              </text>
            ) : null}
          </g>
        ))}
        <line x1={PAD_L} y1={baseline} x2={PAD_L + PLOT_W} y2={baseline} stroke={CHART.gridStrong} strokeWidth={1} />

        {/* the barcode row: a mark per session, height by that day's load */}
        {daily.map((v, i) =>
          v > 0 ? (
            <rect
              key={i}
              className="chart-rise"
              style={{ animationDelay: `${i * CHART.motion.staggerDot}ms` }}
              x={x(i) - 1.6}
              y={baseline + 6 + BARCODE_H - Math.max(3, (v / maxDaily) * BARCODE_H)}
              width={3.2}
              height={Math.max(3, (v / maxDaily) * BARCODE_H)}
              fill="var(--ink)"
              fillOpacity={0.55}
            />
          ) : null,
        )}

        {/* the 28-day average, named, detailed words only */}
        {showChronic && chronicPts.length > 1 ? (
          <>
            <path d={smoothPath(chronicPts)} fill="none" stroke={CHART.ladder[2]} strokeWidth={CHART.hairline} pathLength={1} className="chart-draw" strokeLinejoin="round" />
            <circle cx={todayX} cy={y(chronic[DAYS - 1])} r={CHART.markRadius} fill={CHART.ladder[2]} />
            <text x={todayX + 10} y={chronicLabelY + 4} fontSize={readingSize} fontWeight={700} fill="var(--ink-dim)" style={mono}>
              {endChronic.toLocaleString("en-GB")}
            </text>
            <text x={todayX + 10} y={chronicLabelY + 16} fontSize={tickSize} letterSpacing={1.2} fill="var(--ink-faint)" style={mono}>
              {"28-DAY AVG"}
            </text>
          </>
        ) : null}

        {/* his week: the lead line, with its reading at the end */}
        {acutePts.length > 1 ? (
          <>
            <path d={smoothPath(acutePts)} fill="none" stroke={CHART.ladder[0]} strokeWidth={CHART.lead} pathLength={1} className="chart-draw" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={todayX} cy={y(acute[DAYS - 1])} r={CHART.beadRadius} fill="var(--mint)" />
            <text x={todayX + 10} y={y(acute[DAYS - 1]) - 4} fontSize={readingSize} fontWeight={700} fill="var(--ink)" style={mono}>
              {endAcute.toLocaleString("en-GB")}
            </text>
            <text x={todayX + 10} y={y(acute[DAYS - 1]) + 8} fontSize={tickSize} letterSpacing={1.2} fill="var(--ink-dim)" style={mono}>
              {mode === "plain" ? "HIS WEEK" : "7-DAY SUM"}
            </text>
          </>
        ) : null}

        {/* the one annotation */}
        {note ? (
          <g data-testid="chart-annotation">
            <line x1={noteX} y1={PAD_T - 14} x2={noteX} y2={baseline} stroke={note.tone === "bad" ? "var(--out)" : "var(--gold)"} strokeWidth={1} strokeOpacity={0.7} />
            <circle cx={noteX} cy={noteY} r={CHART.beadRadius} fill="var(--panel)" stroke={note.tone === "bad" ? "var(--out)" : "var(--gold)"} strokeWidth={1.5} />
            <text
              x={noteRight ? noteX - 8 : noteX + 8}
              y={PAD_T - 16}
              textAnchor={noteRight ? "end" : "start"}
              fontSize={11 * type}
              letterSpacing={1}
              fill={note.tone === "bad" ? "var(--out)" : "var(--gold)"}
              style={mono}
            >
              {note.text}
            </text>
          </g>
        ) : null}

        {/* today */}
        <text x={todayX - 8} y={baseline + 16} textAnchor="end" fontSize={tickSize} letterSpacing={1.4} fill="var(--mint)" fillOpacity={0.8} style={mono}>
          today
        </text>
        <text x={PAD_L} y={baseline + 16} fontSize={tickSize} letterSpacing={1.4} fill="var(--ink-faint)" style={mono}>
          six weeks ago
        </text>
      </svg>
      <figcaption className="mt-3">
        <p className="annot flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{chartCaption(mode)}</span>
          {flag === "red" ? <span className="text-out">{mode === "plain" ? "// the red band is this week" : "// acute spike, last 7 days"}</span> : null}
        </p>
        <p className={`mt-2 max-w-[70ch] text-[12.5px] leading-snug text-ink-dim ${mode === "detailed" ? "num" : ""}`} data-testid="chart-meaning">
          {meaningA} {meaningB}
        </p>
      </figcaption>
    </figure>
  );
}
