"use client";

/**
 * The season injury map: a smooth figure you can turn, with one chip per
 * injured region under it. Hover a part or a chip and only that part lights.
 * Choose a chip and he turns to show you the side it is on.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import type { Injury } from "@/lib/types";

import { useReducedMotion, useSceneTokens } from "@/components/three/tokens";
import { BACK_REGIONS, PARTS, partKey } from "./body-geometry";
import { marksFor, type Mark } from "./body-figure";
import { REGION_LABEL, formatDate } from "./labels";

const BodyFigure = dynamic(() => import("./body-figure"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-panel" aria-hidden />,
});

/** Apple's deceleration projection: where a flick would come to rest. */
function project(velocity: number, rate = 0.995): number {
  return ((velocity / 1000) * rate) / (1 - rate);
}

export type BodyMapProps = {
  injuries: Injury[];
  asOf: string;
};

export default function BodyMap({ injuries, asOf }: BodyMapProps) {
  const tokens = useSceneTokens();
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const yawTarget = useRef(0);
  const drag = useRef({ on: false, lastX: 0, lastT: 0, vel: 0, moved: 0 });

  const marks = useMemo(() => marksFor(injuries, asOf), [injuries, asOf]);
  const live = marks.filter((m) => m.own.length > 0);
  const current = live.filter((m) => m.current);

  const turnTo = useCallback((side: "front" | "back") => {
    // nearest multiple of 2π to where he is, so a back->front never spins the long way
    const base = Math.round(yawTarget.current / (2 * Math.PI)) * 2 * Math.PI;
    yawTarget.current = side === "front" ? base : base + Math.PI;
    setFacing(side);
  }, []);

  const showMark = useCallback(
    (m: Mark | null) => {
      setHovered(m ? m.key : null);
      if (m && m.part.region) turnTo(BACK_REGIONS.has(m.part.region) ? "back" : "front");
    },
    [turnTo],
  );

  // drag to turn: 1:1 with the pointer, then a flick projects forward
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { on: true, lastX: e.clientX, lastT: performance.now(), vel: 0, moved: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.on) return;
    const now = performance.now();
    const dx = e.clientX - d.lastX;
    const dt = Math.max(1, now - d.lastT);
    d.vel = (dx / dt) * 1000; // px/s
    d.lastX = e.clientX;
    d.lastT = now;
    d.moved += Math.abs(dx);
    yawTarget.current += dx * 0.011;
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d.on) return;
    d.on = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!reduced && d.moved > 4) yawTarget.current += project(d.vel) * 0.011;
    // settle on whichever face is nearer, and tell the buttons
    const snapped = Math.round(yawTarget.current / Math.PI) * Math.PI;
    yawTarget.current = snapped;
    setFacing(Math.abs((snapped / Math.PI) % 2) === 1 ? "back" : "front");
  };

  useEffect(() => {
    return () => {
      document.body.style.cursor = "";
    };
  }, []);

  return (
    <section aria-labelledby="body-map-heading">
      <div className="flex items-baseline justify-between gap-4 border-b border-line pb-2">
        <p className="annot" id="body-map-heading">{"// season injury map"}</p>
        <Legend />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,220px)]">
        <div
          className="relative aspect-[3/4] w-full max-h-[560px] touch-none select-none overflow-hidden border border-line bg-panel"
          data-testid="body-figure"
          data-facing={facing}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {tokens ? (
            <BodyFigure
              injuries={injuries}
              asOf={asOf}
              tokens={tokens}
              reduced={reduced}
              hovered={hovered}
              onHover={setHovered}
              yawTarget={yawTarget}
            />
          ) : null}
          <div role="group" aria-label="turn the figure" className="absolute left-3 top-3 flex overflow-hidden rounded-[3px] border border-line">
            {(["front", "back"] as const).map((side) => (
              <button
                key={side}
                type="button"
                aria-pressed={facing === side}
                onClick={() => turnTo(side)}
                onPointerDown={(e) => e.stopPropagation()}
                className={`pressable h-7 px-3 text-[11px] font-semibold tracking-[0.1em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
                  facing === side ? "bg-mint text-mint-ink" : "bg-panel-2 text-ink-dim hover:text-ink"
                }`}
              >
                {side}
              </button>
            ))}
          </div>
          <p className="pointer-events-none absolute bottom-3 left-3 text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">
            drag to turn
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[10.5px] tracking-[0.14em] uppercase text-ink-dim">injured this season</p>
            {live.length === 0 ? (
              <p className="mt-2 text-[12.5px] text-ink-dim">Nothing marked. Clean so far.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1.5">
                {live.map((m) => (
                  <li key={m.key}>
                    <button
                      type="button"
                      data-region={m.part.region}
                      data-side={m.part.side}
                      data-step={m.current ? "current" : m.step}
                      data-live="1"
                      onMouseEnter={() => showMark(m)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => showMark(m)}
                      onBlur={() => setHovered(null)}
                      onClick={() => showMark(m)}
                      className={`pressable flex w-full items-baseline gap-2 border-l-2 bg-panel px-2.5 py-1.5 text-left transition-colors duration-[190ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
                        hovered === m.key ? "bg-panel-2" : ""
                      }`}
                      style={{ borderColor: m.current ? "var(--out)" : "var(--line-strong)" }}
                    >
                      <span className={`text-[12.5px] font-bold lowercase ${m.current ? "text-out" : "text-ink"}`}>
                        {REGION_LABEL[m.part.region!]}
                      </span>
                      <span className="text-[11px] text-ink-dim">
                        {m.part.side !== "central" ? `${m.part.side} · ` : ""}
                        {m.current ? m.current.severity : `${m.days} days`}
                      </span>
                      {m.current ? (
                        <span className="num ml-auto text-[11px] text-ink-dim">
                          {m.current.expected_return ? `out → ${formatDate(m.current.expected_return)}` : "out → no date"}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[11.5px] leading-snug text-ink-dim">
            {current.length > 0
              ? `${current.length} live injur${current.length === 1 ? "y" : "ies"}: shown in red, the rest tint by days out.`
              : "No live injury. Past ones tint by days out."}
          </p>
          <p className="sr-only">
            {PARTS.filter((p) => p.region).length} body regions drawn; {live.length} carry an injury this season.
          </p>
        </div>
      </div>
    </section>
  );
}

function Legend() {
  const swatches: { label: string; style: CSSProperties }[] = [
    { label: "clear", style: { background: "var(--skin)", border: "1px solid var(--line-strong)" } },
    { label: "past", style: { background: "var(--out)", opacity: 0.5 } },
    { label: "current", style: { background: "var(--out)" } },
  ];
  return (
    <ul className="flex items-center gap-4">
      {swatches.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span aria-hidden className="block h-2.5 w-2.5" style={s.style} />
          <span className="text-[11px] tracking-wide text-ink-dim">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

// partKey is re-exported for tests that need to address a part the way the map does
export { partKey };
