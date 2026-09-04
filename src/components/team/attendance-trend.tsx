/**
 * Two hairlines, one per played match: how many said "in" before kickoff and
 * how many came through the gate. Lupi grammar from the chart tokens: a mark
 * per record, the unit written at the end, a ledger grid, one gold annotation
 * on the best home crowd. Server-rendered SVG, no library.
 */
import { CHART } from "@/lib/tokens/charts";
import type { AttendancePoint } from "@/lib/team/data";
import { shortDate } from "@/components/squad/format";

const W = 640;
const H = 220;
const PAD = { l: 8, r: 96, t: 34, b: 30 };

export function AttendanceTrend({ points, next }: { points: AttendancePoint[]; next: { opponent: string; venue: "H" | "A"; weekday: string } | null }) {
  const withCalls = points.filter((p) => p.calledIn !== null && p.calledIn > 0);
  const withCrowd = points.filter((p) => p.crowd !== null);

  if (withCalls.length === 0 && withCrowd.length === 0) {
    return (
      <Frame>
        <p className="px-5 py-6 text-[13px] text-ink-dim">
          {next
            ? `no calls yet, first one is ${next.opponent} ${next.venue === "H" ? "at home" : "away"} on ${next.weekday}`
            : "no calls yet, and no fixture in the diary to call for"}
        </p>
      </Frame>
    );
  }

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

  return (
    <Frame>
      <figure className="px-3 pb-3 pt-2 sm:px-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="calls and crowd per match this season">
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
              <text key={`t${p.date}`} x={x(i)} y={H - 10} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} fontSize={CHART.tick.size} letterSpacing={CHART.tick.spacing} fill="var(--ink-faint)" style={{ fontFamily: CHART.tick.family, textTransform: "uppercase" }}>
                {shortDate(p.date)}
              </text>
            ) : null,
          )}
          {lastCrowd ? (
            <text x={W - PAD.r + 12} y={yCrowd(lastCrowd.crowd!) + 4} fontSize={CHART.reading.size} fontWeight={CHART.reading.weight} fill="var(--ink)" style={{ fontFamily: CHART.reading.family }}>
              {lastCrowd.crowd} <tspan fontWeight={400} fill="var(--ink-dim)" fontSize={CHART.tick.size}>crowd</tspan>
            </text>
          ) : null}
          {lastCalls && lastCalls.calledIn ? (
            <text x={W - PAD.r + 12} y={yCalls(lastCalls.calledIn) + (lastCrowd && Math.abs(yCalls(lastCalls.calledIn) - yCrowd(lastCrowd.crowd!)) < 14 ? 16 : 4)} fontSize={CHART.reading.size} fontWeight={CHART.reading.weight} fill={CHART.accent} style={{ fontFamily: CHART.reading.family }}>
              {lastCalls.calledIn} <tspan fontWeight={400} fill="var(--ink-dim)" fontSize={CHART.tick.size}>in</tspan>
            </text>
          ) : null}
          {best && bestIdx >= 0 ? (
            <g>
              <line x1={x(bestIdx)} x2={x(bestIdx)} y1={yCrowd(best.crowd!) - 6} y2={PAD.t - 8} stroke={CHART.annotationDim} strokeWidth={1} strokeDasharray="2 3" />
              <text x={x(bestIdx) + (bestIdx > n / 2 ? -6 : 6)} y={PAD.t - 12} textAnchor={bestIdx > n / 2 ? "end" : "start"} fontSize={CHART.tick.size} letterSpacing="0.08em" fill={CHART.annotation} style={{ fontFamily: CHART.tick.family }}>
                best crowd · {best.crowd} v {best.opponent}
              </text>
            </g>
          ) : null}
        </svg>
        <figcaption className="annot mt-1 flex flex-wrap gap-x-4 gap-y-1 text-gold-dim">
          <span>{"// each mark a match"}</span>
          <span className="text-ink-dim">white = through the gate</span>
          <span className="text-mint">mint = called in</span>
        </figcaption>
      </figure>
    </Frame>
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
