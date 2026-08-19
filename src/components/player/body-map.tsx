"use client";

/**
 * The season injury map: two angular athletic silhouettes, front and back,
 * built entirely out of the body regions themselves. Every facet is a real
 * region, so the figure is the legend.
 *
 * Anatomical mirroring: the FRONT figure is drawn as if you are looking at the
 * player, so his right side is on your left. The BACK figure is drawn as if you
 * are stood behind him, so his right side is on your right. The small R / L
 * marks under each figure say which is which, because a body map that quietly
 * flips sides is worse than no body map.
 */

import { useState, type CSSProperties } from "react";
import type { BodyRegion, Injury, Side } from "@/lib/types";
import { REGION_LABEL, daysOut, formatDate, formatMonthYear } from "./labels";

type Point = readonly [number, number];
type Poly = readonly Point[];

/** Polygon -> closed SVG path. */
function toPath(poly: Poly): string {
  return `M${poly.map(([x, y]) => `${x},${y}`).join("L")}Z`;
}

/** Reflect across the figure's midline (x = 100). */
function mirror(poly: Poly): Poly {
  return poly.map(([x, y]) => [200 - x, y] as const);
}

function centroid(poly: Poly): Point {
  const sx = poly.reduce((t, p) => t + p[0], 0);
  const sy = poly.reduce((t, p) => t + p[1], 0);
  return [sx / poly.length, sy / poly.length];
}

/* ── geometry ────────────────────────────────────────────────
   viewBox 0 0 200 440. One canonical half is authored for the
   viewer-left of the figure; the other half is `mirror`ed, so the
   two sides can never drift apart. Facets are cut on hard angles
   deliberately - this is a chart of a body, not a drawing of one. */

const HEAD: Poly = [
  [100, 16],
  [115, 26],
  [117, 48],
  [100, 62],
  [83, 48],
  [85, 26],
];
const NECK: Poly = [
  [91, 58],
  [109, 58],
  [112, 76],
  [88, 76],
];
const SHOULDER_L: Poly = [
  [88, 74],
  [68, 79],
  [54, 95],
  [63, 111],
  [79, 101],
  [83, 84],
];
const ARM_L: Poly = [
  [54, 95],
  [63, 111],
  [63, 150],
  [62, 186],
  [45, 190],
  [43, 144],
  [47, 110],
];
const HAND_L: Poly = [
  [45, 190],
  [62, 186],
  [61, 213],
  [47, 217],
];
const TRUNK_UPPER: Poly = [
  [86, 75],
  [100, 79],
  [114, 75],
  [119, 90],
  [120, 113],
  [100, 123],
  [80, 113],
  [81, 90],
];
const TRUNK_LOWER: Poly = [
  [80, 113],
  [100, 123],
  [120, 113],
  [121, 137],
  [118, 161],
  [100, 167],
  [82, 161],
  [79, 137],
];
const PELVIS_L: Poly = [
  [82, 161],
  [100, 167],
  [100, 197],
  [85, 205],
  [72, 187],
  [75, 164],
];
const GROIN: Poly = [
  [93, 197],
  [107, 197],
  [105, 219],
  [100, 229],
  [95, 219],
];
const THIGH_L: Poly = [
  [75, 187],
  [86, 204],
  [91, 213],
  [90, 251],
  [88, 289],
  [70, 291],
  [65, 243],
  [69, 205],
];
const KNEE_L: Poly = [
  [70, 291],
  [88, 289],
  [88, 315],
  [70, 317],
];
const LOWER_LEG_L: Poly = [
  [70, 317],
  [88, 315],
  [86, 349],
  [85, 383],
  [71, 385],
  [69, 349],
];
const TENDON_L: Poly = [
  [71, 385],
  [85, 383],
  [85, 399],
  [72, 401],
];
const FOOT_L: Poly = [
  [72, 401],
  [85, 399],
  [86, 413],
  [60, 415],
  [63, 403],
];
const HEEL_L: Poly = [
  [72, 401],
  [85, 399],
  [88, 414],
  [69, 416],
];

export type Shape = {
  region: BodyRegion;
  side: Side;
  poly: Poly;
};

/** A two-sided region: the authored half plus its mirror. */
function pair(region: BodyRegion, poly: Poly, leftHalf: Side): Shape[] {
  const rightHalf: Side = leftHalf === "left" ? "right" : "left";
  return [
    { region, side: leftHalf, poly },
    { region, side: rightHalf, poly: mirror(poly) },
  ];
}

function figure(view: "front" | "back"): {
  shapes: Shape[];
  filler: Poly[];
} {
  // Looking AT him: viewer-left is his right. Stood behind him: viewer-left is
  // his left.
  const leftHalf: Side = view === "front" ? "right" : "left";
  const common: Shape[] = [
    { region: "head", side: "central", poly: HEAD },
    { region: "neck", side: "central", poly: NECK },
    ...pair("shoulder", SHOULDER_L, leftHalf),
    ...pair("arm", ARM_L, leftHalf),
    ...pair("wrist_hand", HAND_L, leftHalf),
  ];

  if (view === "front") {
    return {
      shapes: [
        ...common,
        { region: "chest", side: "central", poly: TRUNK_UPPER },
        ...pair("hip", PELVIS_L, leftHalf),
        { region: "groin", side: "central", poly: GROIN },
        ...pair("quad", THIGH_L, leftHalf),
        ...pair("knee", KNEE_L, leftHalf),
        ...pair("shin", LOWER_LEG_L, leftHalf),
        ...pair("ankle", TENDON_L, leftHalf),
        ...pair("foot", FOOT_L, leftHalf),
      ],
      // abdomen carries no region of its own: drawn, never clickable.
      filler: [TRUNK_LOWER, mirror(TRUNK_LOWER)],
    };
  }

  return {
    shapes: [
      ...common,
      { region: "back_upper", side: "central", poly: TRUNK_UPPER },
      { region: "back_lower", side: "central", poly: TRUNK_LOWER },
      ...pair("hamstring", THIGH_L, leftHalf),
      ...pair("calf", LOWER_LEG_L, leftHalf),
      ...pair("achilles", TENDON_L, leftHalf),
    ],
    // glutes, back of knee, heel: structure only. No groin wedge back here -
    // it is a front-of-body landmark and reads as a hole from behind.
    filler: [
      PELVIS_L,
      mirror(PELVIS_L),
      KNEE_L,
      mirror(KNEE_L),
      HEEL_L,
      mirror(HEEL_L),
    ],
  };
}

const FRONT = figure("front");
const BACK = figure("back");

/* ── tinting ─────────────────────────────────────────────────
   Cumulative days out drives the tint. Three steps, so a knock
   never reads like a cruciate. */

const TINT_STEPS = [0.25, 0.5, 0.8] as const;

function tintStep(days: number): 0 | 1 | 2 | 3 {
  if (days <= 0) return 0;
  if (days < 14) return 1;
  if (days < 42) return 2;
  return 3;
}

/**
 * Injuries that belong to one facet. A `central` injury on a two-sided region
 * (a central hamstring is nonsense, but the schema allows it) marks both sides
 * rather than disappearing.
 */
function injuriesFor(shape: Shape, injuries: Injury[]): Injury[] {
  return injuries.filter(
    (i) =>
      i.body_region === shape.region &&
      (i.side === shape.side ||
        i.side === "central" ||
        shape.side === "central"),
  );
}

type Tip = { key: string; x: number; y: number; below: boolean } | null;

export type BodyMapProps = {
  injuries: Injury[];
  asOf: string;
};

export default function BodyMap({ injuries, asOf }: BodyMapProps) {
  const [tip, setTip] = useState<Tip>(null);
  const current = injuries.filter((i) => i.resolved_on === null);

  return (
    <section aria-labelledby="body-map-heading">
      <style>{`
        .im-region { transition: opacity 190ms var(--ease-out-strong); outline: none; }
        @media (hover: hover) {
          .im-region[data-live="1"]:hover { opacity: 0.82; }
        }
        .im-region:focus-visible { stroke: var(--gold); stroke-width: 1.6; }
        .im-pulse { animation: im-pulse 2400ms var(--ease-in-out-strong) infinite; }
        @keyframes im-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.42; }
        }
        @media (prefers-reduced-motion: reduce) {
          .im-pulse { animation: none; }
          .im-region { transition: none; }
        }
      `}</style>

      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <p className="annot" id="body-map-heading">
          {"// season injury map"}
        </p>
        <Legend />
      </div>

      {current.length > 0 ? (
        <ul className="sm:hidden mt-4 flex flex-col gap-2">
          {current.map((injury) => (
            <li
              key={injury.id}
              className="border-l-2 bg-panel px-3 py-2 flex flex-wrap items-baseline gap-x-2"
              style={{ borderColor: "var(--out)" }}
            >
              <span className="text-[13px] font-bold text-ink lowercase">
                {REGION_LABEL[injury.body_region]}
              </span>
              <span className="text-[12px] text-ink-dim">
                {injury.side !== "central" ? injury.side : null} ·{" "}
                {injury.severity}
              </span>
              <span className="num text-[12px] text-ink-dim ml-auto">
                {injury.expected_return
                  ? `out → ${formatDate(injury.expected_return)}`
                  : "out → no date"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-6 flex items-start justify-center">
        <Figure
          view="front"
          data={FRONT}
          injuries={injuries}
          asOf={asOf}
          tip={tip}
          setTip={setTip}
          calloutSide="left"
        />
        <Figure
          view="back"
          data={BACK}
          injuries={injuries}
          asOf={asOf}
          tip={tip}
          setTip={setTip}
          calloutSide="right"
        />
      </div>
    </section>
  );
}

function Legend() {
  const swatches: { label: string; style: CSSProperties }[] = [
    {
      label: "clear",
      style: { background: "var(--panel-2)", border: "1px solid var(--line-strong)" },
    },
    { label: "past", style: { background: "var(--out)", opacity: 0.5 } },
    { label: "current", style: { background: "var(--out)" } },
  ];
  return (
    <ul className="flex items-center gap-4">
      {swatches.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span aria-hidden className="block w-2.5 h-2.5" style={s.style} />
          <span className="text-[11px] text-ink-dim tracking-wide">
            {s.label}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Figure({
  view,
  data,
  injuries,
  asOf,
  tip,
  setTip,
  calloutSide,
}: {
  view: "front" | "back";
  data: { shapes: Shape[]; filler: Poly[] };
  injuries: Injury[];
  asOf: string;
  tip: Tip;
  setTip: (t: Tip) => void;
  calloutSide: "left" | "right";
}) {
  const marks = data.shapes.map((shape) => {
    const own = injuriesFor(shape, injuries);
    const current = own.find((i) => i.resolved_on === null) ?? null;
    const days = own.reduce((t, i) => t + daysOut(i, asOf), 0);
    const [cx, cy] = centroid(shape.poly);
    return {
      shape,
      own,
      current,
      step: tintStep(days),
      days,
      key: `${view}-${shape.region}-${shape.side}`,
      cx,
      cy,
    };
  });

  const callouts = marks.filter((m) => m.current);

  return (
    <div
      className={`flex-1 min-w-0 flex ${
        calloutSide === "left" ? "justify-end pr-3" : "justify-start pl-3"
      }`}
    >
      <div className="w-[132px] sm:w-[168px] lg:w-[212px]">
      <div className="relative w-full aspect-[200/440]">
        <svg
          viewBox="0 0 200 440"
          className="absolute inset-0 w-full h-full block overflow-visible"
          role="group"
          aria-label={`${view} view, injury map`}
        >
          {/* base plate: everything sits on one flat panel-2 body */}
          {data.filler.map((poly, i) => (
            <path
              key={`f-${i}`}
              d={toPath(poly)}
              fill="var(--panel-2)"
              stroke="var(--line-strong)"
              strokeWidth={0.9}
            />
          ))}

          {marks.map((m) => {
            const live = m.own.length > 0;
            const fill = m.current
              ? "var(--out)"
              : m.step === 0
                ? "var(--panel-2)"
                : "var(--out)";
            const fillOpacity = m.current
              ? 1
              : m.step === 0
                ? 1
                : TINT_STEPS[m.step - 1];
            const label = m.current
              ? `${REGION_LABEL[m.shape.region]}, ${m.shape.side}, currently out`
              : live
                ? `${REGION_LABEL[m.shape.region]}, ${m.shape.side}, ${m.days} days out this season`
                : `${REGION_LABEL[m.shape.region]}, ${m.shape.side}, no injuries`;
            return (
              <path
                key={m.key}
                className={`im-region${m.current ? " im-pulse region-current" : ""}`}
                data-view={view}
                data-region={m.shape.region}
                data-side={m.shape.side}
                data-live={live ? "1" : "0"}
                data-step={m.current ? "current" : m.step}
                d={toPath(m.shape.poly)}
                fill={fill}
                fillOpacity={fillOpacity}
                stroke={m.current ? "var(--out)" : "var(--line-strong)"}
                strokeWidth={m.current ? 1.5 : 0.9}
                strokeLinejoin="miter"
                tabIndex={live ? 0 : -1}
                role={live ? "button" : undefined}
                aria-label={live ? label : undefined}
                aria-hidden={live ? undefined : true}
                onMouseEnter={
                  live
                    ? () =>
                        setTip({
                          key: m.key,
                          x: m.cx,
                          y: m.cy,
                          below: m.cy < 140,
                        })
                    : undefined
                }
                onMouseLeave={live ? () => setTip(null) : undefined}
                onFocus={
                  live
                    ? () =>
                        setTip({
                          key: m.key,
                          x: m.cx,
                          y: m.cy,
                          below: m.cy < 140,
                        })
                    : undefined
                }
                onBlur={live ? () => setTip(null) : undefined}
              />
            );
          })}

          {/* leader lines out to the callout chips */}
          {callouts.map((m) => {
            const edge = calloutSide === "left" ? 0 : 200;
            const elbowX = calloutSide === "left" ? m.cx - 26 : m.cx + 26;
            return (
              <g key={`c-${m.key}`} aria-hidden>
                <path
                  d={`M${m.cx},${m.cy}L${elbowX},${m.cy - 14}L${edge},${m.cy - 14}`}
                  fill="none"
                  stroke="var(--out)"
                  strokeWidth={0.9}
                  strokeOpacity={0.75}
                />
                <circle cx={m.cx} cy={m.cy} r={2.2} fill="var(--out)" />
              </g>
            );
          })}
        </svg>

        {/* tooltips live in the same box, so % of the box == SVG units */}
        {marks.map((m) =>
          tip && tip.key === m.key ? (
            <div
              key={`t-${m.key}`}
              role="tooltip"
              className="absolute z-20 pointer-events-none min-w-44 max-w-56 bg-panel border border-line-strong px-3 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.55)]"
              style={{
                left: `${(m.cx / 200) * 100}%`,
                top: `${(m.cy / 440) * 100}%`,
                transform: tip.below
                  ? "translate(-50%, 12px)"
                  : "translate(-50%, calc(-100% - 12px))",
              }}
            >
              <p className="text-[12px] font-bold text-ink lowercase">
                {REGION_LABEL[m.shape.region]}
                {m.shape.side !== "central" ? (
                  <span className="text-ink-dim font-normal">
                    {" "}
                    · {m.shape.side}
                  </span>
                ) : null}
              </p>
              <ul className="mt-1.5 space-y-1">
                {m.own.map((i) => (
                  <li
                    key={i.id}
                    className="text-[11px] text-ink-dim leading-tight num"
                  >
                    {i.severity} · {formatMonthYear(i.occurred_on)} ·{" "}
                    {daysOut(i, asOf)} days
                    {i.resolved_on === null ? (
                      <span className="text-out"> · ongoing</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null,
        )}

        {/* current-injury callout chips */}
        {callouts.map((m) => (
          <div
            key={`chip-${m.key}`}
            data-callout="chip"
            className="hidden sm:block absolute z-10 w-[122px] lg:w-[130px]"
            style={
              {
                top: `${((m.cy - 14) / 440) * 100}%`,
                right: calloutSide === "left" ? "calc(100% + 10px)" : undefined,
                left: calloutSide === "right" ? "calc(100% + 10px)" : undefined,
                transform: "translateY(-50%)",
                textAlign: calloutSide === "left" ? "right" : "left",
              } satisfies CSSProperties
            }
          >
            <div
              className={`inline-block bg-panel px-2.5 py-1.5 ${
                calloutSide === "left" ? "border-r-2" : "border-l-2"
              }`}
              style={{ borderColor: "var(--out)" }}
            >
              <p className="text-[11px] font-bold text-ink lowercase leading-tight">
                {REGION_LABEL[m.shape.region]}
                <span className="text-ink-dim font-normal">
                  {" "}
                  {m.shape.side !== "central" ? m.shape.side : ""}
                </span>
              </p>
              <p className="annot mt-0.5 !text-[10px] !tracking-[0.1em] text-out">
                {m.current!.severity}
              </p>
              <p className="num text-[11px] text-ink-dim mt-0.5">
                {m.current!.expected_return
                  ? `out → ${formatDate(m.current!.expected_return)}`
                  : "out → no date"}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2">
        <span className="annot !text-[10px] text-gold-dim">
          {view === "front" ? "R" : "L"}
        </span>
        <span className="text-[11px] text-ink-dim tracking-[0.14em] uppercase">
          {view}
        </span>
        <span className="annot !text-[10px] text-gold-dim">
          {view === "front" ? "L" : "R"}
        </span>
      </div>
      </div>
    </div>
  );
}
