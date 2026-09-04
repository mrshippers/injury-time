/**
 * Two hairlines, one per played match: how many said "in" before kickoff and
 * how many came through the gate. Lupi grammar from the chart tokens: a mark
 * per record, the unit written at the end, a ledger grid, one gold annotation
 * on the best home crowd. Server-rendered SVG, no library. Two drawings, CSS
 * shows one: a wide frame, and a phone frame whose viewBox is the phone's
 * own width so the type is real pixels and the annotation has a band above
 * the plot.
 */
import { CHART } from "@/lib/tokens/charts";
import type { AttendancePoint } from "@/lib/team/data";
import { shortDate } from "@/components/squad/format";

type Frame = { W: number; H: number; PAD: { l: number; r: number; t: number; b: number }; tick: number; reading: number; noteY: number };

const WIDE: Frame = { W: 640, H: 220, PAD: { l: 8, r: 96, t: 34, b: 30 }, tick: CHART.tick.size, reading: CHART.reading.size, noteY: 22 };
const PHONE: Frame = { W: 320, H: 232, PAD: { l: 6, r: 84, t: 44, b: 30 }, tick: 11.5, reading: 13, noteY: 18 };

export function AttendanceTrend({ points, next }: { points: AttendancePoint[]; next: { opponent: string; venue: "H" | "A"; weekday: string } | null }) {
  const withCalls = points.filter((p) => p.calledIn !== null && p.calledIn > 0);
  const withCrowd = points.filter((p) => p.crowd !== null);

  if (withCalls.length === 0 && withCrowd.length === 0) {
    return (
      <Frame>
        <p className="px-4 py-6 text-[13.5px] text-ink-dim sm:px-5 sm:text-[13px]">
          {next
            ? `no calls yet, first one is ${next.opponent} ${next.venue === "H" ? "at home" : "away"} on ${next.weekday}`
            : "no calls yet, and no fixture in the diary to call for"}
        </p>
      </Frame>
    );
  }

  return (
    <Frame>
      <figure className="px-3 pb-3 pt-2 sm:px-4">
        <Drawing f={WIDE} points={points} className="hidden sm:block" />
        <Drawing f={PHONE} points={points} className="sm:hidden" />
        <figcaption className="annot mt-1 flex flex-wrap gap-x-4 gap-y-1 text-gold-dim">
          <span>{"// each mark a match"}</span>
          <span className="text-ink-dim">white = through the gate</span>
          <span className="text-mint">mint = called in</span>
        </figcaption>
      </figure>
    </Frame>
  );
}

function Drawing({ f, points, className }: { f: Frame; points: AttendancePoint[]; className: string }) {
  const { W, H, PAD } = f;
  const withCalls = points.filter((p) => p.calledIn !== null && p.calledIn > 0);
  const withCrowd = points.filter((p) => p.crowd !== null);
  const n = points.length;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n === 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const maxCrowd = Math.max(1, ...withCrowd.map((p) => p.crowd!));
  const maxCalls = Math.max(1, ...withCalls.map((p) => p.calledIn!));
  const yCrowd = (v: number) => PAD.t + innerH - (v / maxCrowd) * innerH;
  const yCalls = (v: number) => PAD.t + innerH - (v / maxCalls) * innerH;

  const crowdPath = pathOf(points.map((p, i) => (p.crowd === null ? null : [x(i), yCrowd(p.crowd)])));
  const callsPath = pathOf(points.map((p, i) => (p.calledIn === null ? null : [x(i), yCalls(p.calledIn)])));

  const lastCrowd = [...points].reverse().find((p) => p.crowd !== null);
  const lastCalls = [...points].reverse().find((p) => p.calledIn !== null);
  const best = withCrowd.filter((p) => p.venue === "H").sort((a, b) => b.crowd! - a.crowd!)[0];
  const bestIdx = best ? points.indexOf(best) : -1;
  const ticks = [0, 0.5, 1];
  const mono = { fontFamily: CHART.tick.family } as const;
  // the two end readings must not sit on each other
  const crowdY = lastCrowd ? yCrowd(lastCrowd.crowd!) : 0;
  let callsY = lastCalls && lastCalls.calledIn ? yCalls(lastCalls.calledIn) : 0;
  if (lastCrowd && lastCalls && lastCalls.calledIn && Math.abs(callsY - crowdY) < 16) callsY = callsY >= crowdY ? crowdY + 16 : crowdY - 16;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`block h-auto w-full ${className}`} role="img" aria-label="calls and crowd per match this season">
      {ticks.map((t) => (
        <line key={t} x1={PAD.l} x2={W - PAD.r + 6} y1={PAD.t + innerH - t * innerH} y2={PAD.t + innerH - t * innerH} stroke={CHART.grid} strokeWidth={1} />
      ))}
      {crowdPath ? <path d={crowdPath} fill="none" stroke={CHART.ladder[0]} strokeWidth={CHART.lead} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-draw" /> : null}
      {callsPath ? <path d={callsPath} fill="none" stroke={CHART.accent} strokeWidth={CHART.hairline} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-draw" /> : null}
      {points.map((p, i) => (
        <g key={p.date + p.opponent}>
          {p.crowd !== null ? <circle cx={x(i)} cy={yCrowd(p.crowd)} r={CHART.markRadius} fill={CHART.ladder[0]} className="chart-pop" style={{ animationDelay: `${i * CHART.motion.staggerDot}ms` }} /> : null}
          {p.calledIn !== null && p.calledIn > 0 ? <circle cx={x(i)} cy={yCalls(p.calledIn)} r={CHART.markRadius} fill={CHART.accent} className="chart-pop" style={{ animationDelay: `${i * CHART.motion.staggerDot}ms` }} /> : null}
        </g>
      ))}
      {points.map((p, i) =>
        i === 0 || i === n - 1 || (n > 6 && i % Math.max(2, Math.round(n / 4)) === 0 && i < n - 2) ? (
          <text key={`t${p.date}`} x={x(i)} y={H - 10} display={f === PHONE && n > 5 && i !== 0 && i !== n - 1 && i % 2 === 1 ? "none" : undefined} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={f.tick} letterSpacing={CHART.tick.spacing} fill="var(--ink-faint)" style={{ ...mono, textTransform: "uppercase" }}>
            {shortDate(p.date)}
          </text>
        ) : null,
      )}
      {lastCrowd ? (
        <text x={W - PAD.r + 10} y={crowdY + 4} fontSize={f.reading} fontWeight={CHART.reading.weight} fill="var(--ink)" style={{ fontFamily: CHART.reading.family }}>
          {lastCrowd.crowd} <tspan fontWeight={400} fill="var(--ink-dim)" fontSize={f.tick}>crowd</tspan>
        </text>
      ) : null}
      {lastCalls && lastCalls.calledIn ? (
        <text x={W - PAD.r + 10} y={callsY + 4} fontSize={f.reading} fontWeight={CHART.reading.weight} fill={CHART.accent} style={{ fontFamily: CHART.reading.family }}>
          {lastCalls.calledIn} <tspan fontWeight={400} fill="var(--ink-dim)" fontSize={f.tick}>in</tspan>
        </text>
      ) : null}
      {best && bestIdx >= 0 ? (
        <g>
          <line x1={x(bestIdx)} x2={x(bestIdx)} y1={yCrowd(best.crowd!) - 6} y2={f.noteY + 6} stroke={CHART.annotationDim} strokeWidth={1} strokeDasharray="2 3" />
          <text x={x(bestIdx) + (bestIdx > n / 2 ? -6 : 6)} y={f.noteY} textAnchor={bestIdx > n / 2 ? "end" : "start"} fontSize={f.tick} letterSpacing="0.06em" fill={CHART.annotation} style={mono}>
            best crowd · {best.crowd} v {best.opponent}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="attendance-heading" className="border border-line bg-panel">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <p className="annot" id="attendance-heading">{"// turning up"}</p>
      </div>
      {children}
    </section>
  );
}

function pathOf(pts: ([number, number] | null)[]): string | null {
  let d = "";
  let pen = false;
  for (const p of pts) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
    pen = true;
  }
  return d.length > 0 ? d : null;
}
