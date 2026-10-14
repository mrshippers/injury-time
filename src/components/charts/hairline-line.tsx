import { CHART, beadFill, type Annotation } from "@/lib/tokens/charts";

/**
 * The Lupi hairline: one thin line per series, a mark per record, the real
 * unit written at the end, a ledger grid and no axis lines. Server-rendered
 * SVG; motion is CSS. One gold annotation at most, because a chart with two
 * stories has none.
 */
export type ResultTone = "win" | "draw" | "loss";
/**
 * A point can carry a result. A win is a filled aqua dot, a draw a filled white
 * one, a loss a hollow red ring: shape and brightness say it before hue does, and
 * the tip says it in words on hover, focus or tap.
 */
export type LinePoint = { x: number; y: number; label?: string; tone?: ResultTone; tip?: [string, string?] };
export type LineSeries = {
  points: LinePoint[];
  /** index into CHART.ladder; 0 is the lead */
  rank?: 0 | 1 | 2 | 3;
  /** written at the end of the line, with the unit */
  reading?: string;
  /** hollow bead when the trend runs against the metric */
  against?: boolean;
  /** halo on the terminal bead */
  glow?: boolean;
  name?: string;
};
export type ReferenceLine = {
  from: { x: number; y: number };
  to: { x: number; y: number };
  label: string;
};
export type VerticalMark = { x: number; label: string; tone?: "gold" | "dim" };

export type HairlineLineProps = {
  series: LineSeries[];
  xDomain: [number, number];
  yDomain: [number, number];
  xTicks?: { x: number; label: string }[];
  yTicks?: number[];
  yUnit?: string;
  references?: ReferenceLine[];
  verticals?: VerticalMark[];
  annotation?: Annotation & { y?: number };
  /** drawing size in viewBox units; the SVG scales to its container */
  width?: number;
  height?: number;
  /** room for end readings on the right */
  readingWidth?: number;
  title: string;
  className?: string;
};

export function HairlineLine({
  series,
  xDomain,
  yDomain,
  xTicks = [],
  yTicks = [],
  yUnit = "",
  references = [],
  verticals = [],
  annotation,
  width = 720,
  height = 220,
  readingWidth = 96,
  title,
  className,
}: HairlineLineProps) {
  const padL = 30;
  const padR = readingWidth;
  const padT = 18;
  const padB = 26;
  const w = width - padL - padR;
  const h = height - padT - padB;
  const sx = (x: number) => padL + ((x - xDomain[0]) / Math.max(1e-9, xDomain[1] - xDomain[0])) * w;
  const sy = (y: number) => padT + h - ((y - yDomain[0]) / Math.max(1e-9, yDomain[1] - yDomain[0])) * h;
  const clampX = (x: number) => Math.min(xDomain[1], Math.max(xDomain[0], x));

  const path = (pts: LinePoint[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`).join(" ");

  const annY = annotation ? (annotation.y ?? series[0]?.points.find((p) => p.x === annotation.at)?.y ?? yDomain[1]) : 0;
  const annX = annotation ? sx(clampX(Number(annotation.at))) : 0;
  const annLeft = annotation?.side === "left" || (annotation && annX > padL + w * 0.6);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} className={className} style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}>
      {/* ledger grid */}
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={padL} x2={padL + w} y1={sy(t)} y2={sy(t)} stroke={CHART.grid} strokeWidth={1} />
          <text x={padL - 6} y={sy(t) + 3.5} textAnchor="end" fontSize={CHART.tick.size} fontFamily={CHART.tick.family} letterSpacing={CHART.tick.spacing} fill="var(--ink-faint)" style={{ fontVariantNumeric: "tabular-nums" }}>
            {t}
          </text>
        </g>
      ))}
      {xTicks.map((t) => (
        <text key={`x${t.x}`} x={sx(t.x)} y={height - 8} textAnchor="middle" fontSize={CHART.tick.size} fontFamily={CHART.tick.family} letterSpacing={CHART.tick.spacing} fill="var(--ink-faint)" style={{ textTransform: "uppercase" }}>
          {t.label}
        </text>
      ))}
      {/* reference pace lines */}
      {references.map((r) => (
        <g key={r.label}>
          <line x1={sx(r.from.x)} y1={sy(r.from.y)} x2={sx(clampX(r.to.x))} y2={sy(Math.min(yDomain[1], r.to.y))} stroke={CHART.gridStrong} strokeWidth={1} strokeDasharray="2 4" />
          <text x={sx(clampX(r.to.x)) + 6} y={sy(Math.min(yDomain[1], r.to.y)) + 3.5} fontSize={CHART.tick.size} fontFamily={CHART.tick.family} letterSpacing={CHART.tick.spacing} fill="var(--ink-faint)" style={{ textTransform: "uppercase" }}>
            {r.label}
          </text>
        </g>
      ))}
      {/* vertical marks, the christmas line */}
      {verticals.map((v) => (
        <g key={v.label}>
          <line x1={sx(v.x)} x2={sx(v.x)} y1={padT} y2={padT + h} stroke={v.tone === "gold" ? CHART.annotationDim : CHART.gridStrong} strokeWidth={1} strokeDasharray="1 3" />
          <text x={sx(v.x)} y={padT - 6} textAnchor="middle" fontSize={CHART.tick.size} fontFamily={CHART.tick.family} letterSpacing={CHART.tick.spacing} fill={v.tone === "gold" ? CHART.annotation : "var(--ink-faint)"} style={{ textTransform: "uppercase" }}>
            {v.label}
          </text>
        </g>
      ))}
      {/* series, lead drawn last so it sits on top */}
      {[...series].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0)).map((s, si) => {
        const colour = CHART.ladder[s.rank ?? 0];
        const last = s.points.at(-1);
        const bead = beadFill(Boolean(s.against));
        return (
          <g key={s.name ?? si}>
            {s.points.length > 1 ? (
              <path d={path(s.points)} fill="none" stroke={colour} strokeWidth={(s.rank ?? 0) === 0 ? CHART.lead : CHART.hairline} strokeLinejoin="round" strokeLinecap="round" pathLength={1} className="chart-draw" />
            ) : null}
            {s.points.map((p, i) =>
              p.tone ? (
                <ResultDot key={i} p={p} cx={sx(p.x)} cy={sy(p.y)} delay={Math.min(600, i * CHART.motion.staggerDot)} bounds={[0, width]} />
              ) : (
                <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={CHART.markRadius} fill={colour} className="chart-pop" style={{ animationDelay: `${Math.min(600, i * CHART.motion.staggerDot)}ms` }}>
                  {p.label ? <title>{p.label}</title> : null}
                </circle>
              ),
            )}
            {last ? (
              <g>
                {last.tone ? (
                  // the last game keeps its own mark; the end bead is only a halo around it
                  <circle cx={sx(last.x)} cy={sy(last.y)} r={CHART.beadRadius + 3.2} fill="none" stroke="var(--ink)" strokeOpacity={0.4} strokeWidth={1} />
                ) : (
                  <circle
                    cx={sx(last.x)}
                    cy={sy(last.y)}
                    r={CHART.beadRadius}
                    fill={s.against ? bead.fill : colour}
                    stroke={s.against ? bead.stroke : colour}
                    strokeWidth={1.25}
                    style={s.glow ? { filter: "drop-shadow(0 0 4px var(--mint))" } : undefined}
                  />
                )}
                {s.reading ? (
                  <text x={sx(last.x) + 10} y={sy(last.y) + 4} fontSize={CHART.reading.size} fontWeight={CHART.reading.weight} fontFamily={CHART.reading.family} fill={(s.rank ?? 0) === 0 ? "var(--ink)" : colour} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {s.reading}
                    {yUnit && (s.rank ?? 0) === 0 ? <tspan fill="var(--ink-dim)" fontWeight={400}>{` ${yUnit}`}</tspan> : null}
                  </text>
                ) : null}
              </g>
            ) : null}
          </g>
        );
      })}
      {/* the one annotation */}
      {annotation ? (
        <g>
          <line x1={annX} x2={annX} y1={sy(annY) - 4} y2={sy(annY) - 22} stroke={CHART.annotation} strokeWidth={1} />
          <text x={annX + (annLeft ? -6 : 6)} y={sy(annY) - 26} textAnchor={annLeft ? "end" : "start"} fontSize={CHART.tick.size + 0.5} fontFamily={CHART.tick.family} letterSpacing="0.06em" fill={annotation.tone === "bad" ? CHART.bad : annotation.tone === "good" ? CHART.good : CHART.annotation}>
            {annotation.text}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

const TONE_WORD: Record<ResultTone, string> = { win: "won", draw: "drew", loss: "lost" };

/** One result as a dot: a generous invisible hit area, the mark, and a tip shown by CSS on hover or focus. */
function ResultDot({ p, cx, cy, delay, bounds }: { p: LinePoint; cx: number; cy: number; delay: number; bounds: [number, number] }) {
  const tone = p.tone as ResultTone;
  const [line1, line2] = p.tip ?? [p.label ?? "", undefined];
  const wTip = Math.max(96, Math.max(line1.length, (line2 ?? "").length) * 6.2 + 16);
  const hTip = line2 ? 36 : 22;
  // centred above the dot and clear of its right-hand neighbour (later games sit higher, never lower)
  const tx = Math.min(bounds[1] - wTip, Math.max(bounds[0], cx - wTip / 2));
  const ty = cy - hTip - 16 < 0 ? cy + 14 : cy - hTip - 16;
  return (
    <g className="result-dot" tabIndex={0} role="img" aria-label={`${TONE_WORD[tone]}: ${line1}${line2 ? `, ${line2}` : ""}`}>
      <circle cx={cx} cy={cy} r={11} fill="transparent" />
      {tone === "loss" ? (
        <circle cx={cx} cy={cy} r={3.6} fill="var(--panel)" stroke="var(--out)" strokeWidth={1.9} className="chart-pop" style={{ animationDelay: `${delay}ms` }} />
      ) : (
        <circle cx={cx} cy={cy} r={tone === "win" ? 3.7 : 3.2} fill={tone === "win" ? "var(--win)" : "var(--ink)"} className="chart-pop" style={{ animationDelay: `${delay}ms` }} />
      )}
      <g className="result-tip" pointerEvents="none">
        <rect x={tx} y={ty} width={wTip} height={hTip} rx={2} fill="var(--panel-2)" stroke="var(--line-strong)" />
        <text x={tx + 8} y={ty + 15} fontSize={11.5} fontWeight={700} fontFamily={CHART.label.family} fill="var(--ink)">
          {line1}
        </text>
        {line2 ? (
          <text x={tx + 8} y={ty + 29} fontSize={10.5} fontFamily={CHART.tick.family} fill="var(--ink-dim)">
            {line2}
          </text>
        ) : null}
      </g>
    </g>
  );
}
