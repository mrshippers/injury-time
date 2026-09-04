"use client";

/**
 * Six weeks of load on the lieflat grammar: a hairline for his week (the
 * 7-day sum), a mark per session in a barcode row along the floor, a ledger
 * grid with no axis lines, the real reading written at the end of the line,
 * and ONE annotation in gold at the point that matters. In detailed words the
 * 28-day weekly average joins it, named. Days with no session are drawn as
 * nothing at all, never a zero the eye reads as "a light session".
 *
 * Two drawings are rendered and CSS shows one: a wide frame for a desk and a
 * phone frame whose viewBox is the phone's own width, so type inside the
 * drawing is real pixels and the annotation has a band of its own above the
 * plot instead of sitting on the line.
 */
import { chartCaption, chartMeaning, type LoadFacts } from "@/lib/health/language";
import { useHealthLanguage } from "@/lib/health/store";
import { chronicWeeklyAvg, type AcwrResult, type LoadEntry, type LoadFlag, type WeekOnWeekResult } from "@/lib/load-engine";
import type { Readiness } from "@/lib/readiness";
import { CHART } from "@/lib/tokens/charts";
import type { Injury } from "@/lib/types";

import { REGION_LABEL } from "./labels";

const DAYS = 42;
const BARCODE_H = 16;

type Frame = {
  W: number;
  H: number;
  PAD_T: number;
  PAD_L: number;
  PAD_R: number;
  PAD_B: number;
  PLOT_W: number;
  PLOT_H: number;
  STEP: number;
  /** where the annotation sentence sits: a band above the plot */
  NOTE_Y: number;
  tick: number;
  reading: number;
  note: number;
};

/** The drawing's frame: wide on a desk; on a phone the viewBox is the phone's width so 1 unit is 1 px. */
function frame(narrow: boolean): Frame {
  const W = narrow ? 344 : 900;
  const H = narrow ? 264 : 204;
  const PAD_T = narrow ? 46 : 32;
  const PAD_L = narrow ? 4 : 6;
  const PAD_R = narrow ? 100 : 118;
  // barcode row under the baseline, then the axis words under the barcode
  const PAD_B = 6 + BARCODE_H + 22;
  const PLOT_W = W - PAD_L - PAD_R;
  return {
    W,
    H,
    PAD_T,
    PAD_L,
    PAD_R,
    PAD_B,
    PLOT_W,
    PLOT_H: H - PAD_T - PAD_B,
    STEP: PLOT_W / DAYS,
    NOTE_Y: narrow ? 18 : 16,
    tick: narrow ? 11.5 : CHART.tick.size,
    reading: narrow ? 13 : CHART.reading.size,
    note: narrow ? 11.5 : 11,
  };
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

type Series = {
  daily: number[];
  acute: number[];
  chronic: number[];
  maxDaily: number;
  showChronic: boolean;
  mode: "plain" | "detailed";
  flag: LoadFlag;
  note: Note | null;
};

function Drawing({ f, s, className, ariaLabel, phone }: { f: Frame; s: Series; className: string; ariaLabel: string; phone?: boolean }) {
  const { W, H, PAD_T, PAD_L, PLOT_W, STEP, PLOT_H, NOTE_Y } = f;
  const { daily, acute, chronic, maxDaily, showChronic, mode, flag, note } = s;
  const maxY = Math.max(...acute.slice(6), ...(showChronic ? chronic.slice(27) : []), 1);
  const x = (i: number) => PAD_L + i * STEP + STEP / 2;
  const y = (v: number) => PAD_T + PLOT_H - (v / maxY) * PLOT_H;
  const baseline = PAD_T + PLOT_H;
  const axisY = baseline + 6 + BARCODE_H + 16;
  const acutePts = acute.map((v, i) => [x(i), y(v)] as const).slice(6);
  const chronicPts = chronic.map((v, i) => [x(i), y(v)] as const).slice(27);
  const todayX = x(DAYS - 1);
  const bandX = x(DAYS - 7) - STEP / 2;

  const noteX = note ? x(note.i) : 0;
  const noteOnLine = note ? note.i >= 6 : false;
  const noteY = note ? (noteOnLine ? y(acute[note.i]) : baseline) : 0;
  const noteRight = note ? noteX > PAD_L + PLOT_W * 0.5 : false;

  const endAcute = Math.round(acute[DAYS - 1]);
  const endChronic = Math.round(chronic[DAYS - 1]);
  // two readings at the right edge must not sit on each other: the chronic
  // label steps away from the acute one when the lines end close together
  const acuteY = y(acute[DAYS - 1]);
  let chronicLabelY = y(chronic[DAYS - 1]);
  if (showChronic && Math.abs(chronicLabelY - acuteY) < 30) chronicLabelY = chronicLabelY >= acuteY ? acuteY + 30 : acuteY - 30;
  const ticks = [0.25, 0.5, 0.75, 1].map((fr) => ({ f: fr, v: Math.round(maxY * fr) }));
  const mono = { fontFamily: CHART.tick.family } as const;
  const noteColour = note?.tone === "bad" ? "var(--out)" : "var(--gold)";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`block h-auto w-full ${className}`} role="img" aria-label={ariaLabel}>
      {/* the red-zone band, only when the flag says so */}
      {flag === "red" ? (
        <rect x={bandX} y={PAD_T - 6} width={todayX + STEP / 2 - bandX} height={PLOT_H + 6} fill="var(--out)" fillOpacity={0.08} />
      ) : null}

      {/* ledger grid: hairlines, no axis line */}
      {ticks.map((t) => (
        <g key={t.f}>
          <line x1={PAD_L} y1={y(t.v)} x2={PAD_L + PLOT_W} y2={y(t.v)} stroke={CHART.grid} strokeWidth={1} />
          {showChronic ? (
            <text x={PAD_L + 2} y={y(t.v) - 3} fontSize={f.tick} letterSpacing={1.2} fill="var(--ink-faint)" style={mono}>
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
          <text x={todayX + 8} y={chronicLabelY + 4} fontSize={f.reading} fontWeight={700} fill="var(--ink-dim)" style={mono}>
            {endChronic.toLocaleString("en-GB")}
          </text>
          <text x={todayX + 8} y={chronicLabelY + 17} fontSize={f.tick} letterSpacing={1} fill="var(--ink-faint)" style={mono}>
            {"28-DAY AVG"}
          </text>
        </>
      ) : null}

      {/* his week: the lead line, with its reading at the end */}
      {acutePts.length > 1 ? (
        <>
          <path d={smoothPath(acutePts)} fill="none" stroke={CHART.ladder[0]} strokeWidth={CHART.lead} pathLength={1} className="chart-draw" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={todayX} cy={acuteY} r={CHART.beadRadius} fill="var(--mint)" />
          <text x={todayX + 8} y={acuteY - 3} fontSize={f.reading} fontWeight={700} fill="var(--ink)" style={mono}>
            {endAcute.toLocaleString("en-GB")}
          </text>
          <text x={todayX + 8} y={acuteY + 10} fontSize={f.tick} letterSpacing={1} fill="var(--ink-dim)" style={mono}>
            {mode === "plain" ? "HIS WEEK" : "7-DAY SUM"}
          </text>
        </>
      ) : null}

      {/* the one annotation: a sentence in its own band above the plot, a stem down to the point */}
      {note ? (
        <g data-testid={phone ? "chart-annotation-phone" : "chart-annotation"}>
          <line x1={noteX} y1={NOTE_Y + 6} x2={noteX} y2={baseline} stroke={noteColour} strokeWidth={1} strokeOpacity={0.7} />
          <circle cx={noteX} cy={noteY} r={CHART.beadRadius} fill="var(--panel)" stroke={noteColour} strokeWidth={1.5} />
          <text
            x={noteRight ? noteX - 7 : noteX + 7}
            y={NOTE_Y}
            textAnchor={noteRight ? "end" : "start"}
            fontSize={f.note}
            letterSpacing={1}
            fill={noteColour}
            style={mono}
          >
            {note.text}
          </text>
        </g>
      ) : null}

      {/* the axis words, under the barcode so they never sit on a session mark */}
      <text x={todayX} y={axisY} textAnchor="end" fontSize={f.tick} letterSpacing={1.4} fill="var(--mint)" fillOpacity={0.85} style={mono}>
        today
      </text>
      <text x={PAD_L} y={axisY} fontSize={f.tick} letterSpacing={1.4} fill="var(--ink-faint)" style={mono}>
        six weeks ago
      </text>
    </svg>
  );
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
  const note = pickAnnotation(injuries, asOf, acute, sessionsInWindow);

  const facts: LoadFacts = {
    sessions: daily.slice(DAYS - 7).filter((v) => v > 0).length,
    weekLoad: acute[DAYS - 1],
    chronicAvg: chronicWeeklyAvg(loads, asOf),
    acwr,
    weekChange,
  };
  const [meaningA, meaningB] = chartMeaning(mode, readiness, facts);
  const endAcute = Math.round(acute[DAYS - 1]);
  const series: Series = { daily, acute, chronic, maxDaily, showChronic, mode, flag, note };
  const ariaLabel = `Session load over the last 42 days with the seven-day rolling sum${showChronic ? " and the 28-day weekly average" : ""}. This week ${endAcute} AU.${note ? ` Annotation: ${note.text}.` : ""}`;

  return (
    <figure className="border border-line bg-panel p-4" data-testid="load-chart" data-mode={mode}>
      <Drawing f={frame(false)} s={series} className="hidden sm:block" ariaLabel={ariaLabel} />
      <Drawing f={frame(true)} s={series} className="sm:hidden" ariaLabel={ariaLabel} phone />
      <figcaption className="mt-3">
        <p className="annot flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>{chartCaption(mode)}</span>
          {flag === "red" ? <span className="text-out">{mode === "plain" ? "// the red band is this week" : "// acute spike, last 7 days"}</span> : null}
        </p>
        <p className={`mt-2 max-w-[70ch] text-[13px] leading-snug text-ink-dim sm:text-[12.5px] ${mode === "detailed" ? "num" : ""}`} data-testid="chart-meaning">
          {meaningA} {meaningB}
        </p>
      </figcaption>
    </figure>
  );
}
