/**
 * Six weeks of load, server-rendered. No chart library: this is 42 numbers and
 * a rolling sum, and a dependency for that would cost more than it explains.
 *
 * Days with no session are drawn as nothing at all - a gap, not a zero the eye
 * reads as "a light session", and never a line interpolated across the hole.
 */
import type { LoadEntry, LoadFlag } from "@/lib/load-engine";

const W = 900;
const H = 130;
const PAD_T = 12;
const PAD_B = 18;
const DAYS = 42;
const STEP = W / DAYS;
const BAR_W = 9;
const PLOT_H = H - PAD_T - PAD_B;

function shiftISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Quadratic-midpoint smoothing: rounded joins without a spline library. */
function smoothPath(points: readonly (readonly [number, number])[]): string {
  if (points.length < 2) return "";
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    d += `Q${x0},${y0} ${(x0 + x1) / 2},${(y0 + y1) / 2}`;
  }
  const last = points[points.length - 1];
  return `${d}L${last[0]},${last[1]}`;
}

export default function LoadSparkline({
  loads,
  asOf,
  flag,
}: {
  loads: LoadEntry[];
  asOf: string;
  flag: LoadFlag;
}) {
  // Several sessions can land on one day; the day is what the chart plots.
  const byDate = new Map<string, number>();
  for (const entry of loads) {
    byDate.set(entry.date, (byDate.get(entry.date) ?? 0) + entry.load);
  }

  const daily: number[] = [];
  for (let i = 0; i < DAYS; i += 1) {
    daily.push(byDate.get(shiftISO(asOf, i - (DAYS - 1))) ?? 0);
  }

  const maxDaily = Math.max(...daily, 1);
  const baseline = H - PAD_B;

  // 7-day rolling acute load. The first six days would be summed over a window
  // that runs off the back of the 42 days we hold, so the line starts on day 7
  // rather than drawing six understated points.
  const acute: number[] = daily.map((_, i) =>
    i < 6 ? 0 : daily.slice(i - 6, i + 1).reduce((t, v) => t + v, 0),
  );
  const maxAcute = Math.max(...acute.slice(6), 1);

  const x = (i: number) => i * STEP + STEP / 2;
  const linePoints = acute
    .map((v, i) => [x(i), PAD_T + PLOT_H - (v / maxAcute) * PLOT_H] as const)
    .slice(6);

  const todayX = x(DAYS - 1);
  const bandX = x(DAYS - 7) - STEP / 2;

  return (
    <figure className="border border-line bg-panel p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto block"
        role="img"
        aria-label={`Daily session load over the last 42 days, with the seven-day rolling load. Highest single day ${Math.round(maxDaily)} AU.`}
      >
        {flag === "red" ? (
          <g>
            <rect
              x={bandX}
              y={PAD_T - 4}
              width={W - bandX}
              height={PLOT_H + 8}
              fill="var(--out)"
              fillOpacity={0.09}
            />
            <line
              x1={bandX}
              y1={PAD_T - 4}
              x2={W}
              y2={PAD_T - 4}
              stroke="var(--out)"
              strokeWidth={1}
              strokeOpacity={0.65}
            />
          </g>
        ) : null}

        <line
          x1={0}
          y1={baseline}
          x2={W}
          y2={baseline}
          stroke="var(--line-strong)"
          strokeWidth={1}
        />

        {daily.map((v, i) =>
          v > 0 ? (
            <rect
              key={i}
              x={x(i) - BAR_W / 2}
              y={baseline - (v / maxDaily) * PLOT_H}
              width={BAR_W}
              height={(v / maxDaily) * PLOT_H}
              fill="var(--ink)"
              fillOpacity={0.25}
            />
          ) : null,
        )}

        <path
          d={smoothPath(linePoints)}
          fill="none"
          stroke="var(--gold)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line
          x1={todayX}
          y1={PAD_T - 6}
          x2={todayX}
          y2={baseline}
          stroke="var(--mint)"
          strokeWidth={1}
          strokeOpacity={0.55}
        />
        <rect
          x={todayX - 2.5}
          y={baseline - 2.5}
          width={5}
          height={5}
          fill="var(--mint)"
        />
        <text
          x={todayX - 8}
          y={PAD_T + 2}
          textAnchor="end"
          fill="var(--mint)"
          fillOpacity={0.7}
          fontSize={11}
          letterSpacing={1.4}
          style={{ fontFamily: "var(--font-plex-mono), monospace" }}
        >
          today
        </text>
      </svg>
      <figcaption className="annot mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <span>{"// last six weeks · each bar a session · the line is his week"}</span>
        {flag === "red" ? (
          <span className="text-out">{"// acute spike"}</span>
        ) : null}
      </figcaption>
    </figure>
  );
}
