"use client";

/**
 * The season injury map: the athlete you can turn, one chip per injured
 * region under it, and (for medical staff) his measurements beside it. Hover
 * a part or a chip and only that part lights. Choose a chip and he turns to
 * show you the side it is on. Drag a slider and he changes shape.
 */
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type PointerEvent } from "react";

import { saveBodyParams } from "@/lib/body/actions";
import { hasOwnParams } from "@/lib/body/params";
import { wordFor } from "@/lib/health/language";
import { useHealthLanguage } from "@/lib/health/store";
import type { BodyParams, Injury } from "@/lib/types";

import { useReducedMotion, useSceneTokens } from "@/components/three/tokens";
import { BACK_REGIONS, PARTS, partKey } from "./body-geometry";
import { marksFor, type Mark } from "./body-figure";
import { REGION_LABEL, formatDate } from "./labels";
import MeasurementsPanel from "./measurements-panel";
import { useNarrow } from "./use-narrow";

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
  playerId: string;
  initialParams: BodyParams | null;
  canEdit: boolean;
};

export default function BodyMap({ injuries, asOf, playerId, initialParams, canEdit }: BodyMapProps) {
  const tokens = useSceneTokens();
  const reduced = useReducedMotion();
  const narrow = useNarrow();
  const [mode] = useHealthLanguage();
  // the canvas (and the 1.5 MB body behind it) mounts only once the figure
  // has scrolled into view, and stays mounted after; a phone gets a lower
  // pixel ratio so the clay stays smooth without cooking the battery
  const stage = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = stage.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setInView(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "160px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [facing, setFacing] = useState<"front" | "back">("front");
  const yawTarget = useRef(0);
  const drag = useRef({ on: false, lastX: 0, lastT: 0, vel: 0, moved: 0 });

  // measurements: local for the live figure, saved on release
  const [params, setParams] = useState<BodyParams | null>(initialParams);
  const [editing, setEditing] = useState(false);
  const [saving, startSave] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [surface, setSurface] = useState<"loading" | "parametric" | "sculpt">("loading");
  const onReady = useCallback((parametric: boolean) => setSurface(parametric ? "parametric" : "sculpt"), []);
  // saves go one at a time, in order: a reset must land after the slider
  // release it follows, or the server keeps whichever request finished last
  const queue = useRef<Promise<void>>(Promise.resolve());
  const commit = useCallback(
    (next: BodyParams | null) => {
      startSave(async () => {
        const run = queue.current.then(async () => {
          const res = await saveBodyParams(playerId, next);
          if (res.ok) {
            setSavedAt(Date.now());
            setSaveError(null);
          } else {
            setSaveError(res.error);
          }
        });
        queue.current = run.catch(() => undefined);
        await run;
      });
    },
    [playerId],
  );

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

  const own = hasOwnParams(params);

  return (
    <section aria-labelledby="body-map-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 border-b border-line pb-2">
        <p className="annot" id="body-map-heading">{"// season injury map"}</p>
        <Legend mode={mode} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,232px)]">
        <div
          ref={stage}
          className="relative aspect-[3/4] w-full max-h-[560px] touch-none select-none overflow-hidden border border-line bg-panel"
          data-testid="body-figure"
          data-facing={facing}
          data-surface={surface}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(58% 34% at 50% 90%, var(--turf-2) 0, transparent 72%)", opacity: 0.55 }}
          />
          {tokens && inView ? (
            <BodyFigure
              injuries={injuries}
              asOf={asOf}
              tokens={tokens}
              reduced={reduced}
              hovered={hovered}
              onHover={setHovered}
              yawTarget={yawTarget}
              params={params}
              onReady={onReady}
              dpr={narrow ? [1, 1.5] : [1, 2]}
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
                className={`pressable h-10 px-4 text-[12px] font-semibold tracking-[0.1em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:h-7 sm:px-3 sm:text-[11px] ${
                  facing === side ? "bg-mint text-mint-ink" : "bg-panel-2 text-ink-dim hover:text-ink"
                }`}
              >
                {side}
              </button>
            ))}
          </div>
          {canEdit ? (
            <button
              type="button"
              aria-pressed={editing}
              onClick={() => setEditing((v) => !v)}
              onPointerDown={(e) => e.stopPropagation()}
              className={`pressable absolute right-3 top-3 h-10 rounded-[3px] border border-line px-4 text-[12px] font-semibold tracking-[0.1em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:h-7 sm:px-3 sm:text-[11px] ${
                editing ? "bg-mint text-mint-ink" : "bg-panel-2 text-ink-dim hover:text-ink"
              }`}
            >
              measure
            </button>
          ) : null}
          <p className="pointer-events-none absolute bottom-3 left-3 text-[11.5px] tracking-[0.12em] uppercase text-ink-dim sm:text-[10.5px]">
            drag to turn
          </p>
          <p className="pointer-events-none absolute bottom-3 right-3 text-[11.5px] tracking-[0.12em] uppercase text-ink-faint sm:text-[10.5px]">
            {own ? "his measurements" : "default athlete"}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-[11.5px] tracking-[0.14em] uppercase text-ink-dim sm:text-[10.5px]">injured this season</p>
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
                      className={`pressable flex min-h-11 w-full flex-wrap items-baseline gap-x-2 gap-y-0.5 border-l-2 bg-panel px-3 py-2 text-left transition-colors duration-[190ms] hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:min-h-0 sm:px-2.5 sm:py-1.5 ${
                        hovered === m.key ? "bg-panel-2" : ""
                      }`}
                      style={{ borderColor: m.current ? "var(--out)" : "var(--line-strong)" }}
                    >
                      <span className={`text-[13px] font-bold lowercase sm:text-[12.5px] ${m.current ? "text-out" : "text-ink"}`}>
                        {REGION_LABEL[m.part.region!]}
                      </span>
                      <span className="text-[12px] text-ink-dim sm:text-[11px]">
                        {m.part.side !== "central" ? `${m.part.side} · ` : ""}
                        {m.current ? m.current.severity : `${m.days} days`}
                      </span>
                      {m.current ? (
                        <span className="num ml-auto text-[12px] text-ink-dim sm:text-[11px]">
                          {m.current.expected_return ? `out → ${formatDate(m.current.expected_return)}` : "out → no date"}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-[12.5px] leading-snug text-ink-dim sm:text-[11.5px]">
            {current.length > 0
              ? mode === "plain"
                ? `${current.length} live injur${current.length === 1 ? "y" : "ies"}: shown in red, the rest tint by days out.`
                : `${current.length} unresolved: drawn in red; resolved regions tint by cumulative days lost (under 14, under 42, 42 and over).`
              : mode === "plain"
                ? "No live injury. Past ones tint by days out."
                : "No unresolved injury. Resolved regions tint by cumulative days lost."}
          </p>
          {editing && canEdit ? (
            <>
              <MeasurementsPanel
                params={params}
                onChange={setParams}
                onCommit={commit}
                onReset={() => {
                  setParams(null);
                  commit(null);
                }}
                saving={saving}
                savedAt={savedAt}
              />
              {saveError ? <p className="text-[11.5px] text-out">{saveError}</p> : null}
            </>
          ) : null}
          <p className="sr-only">
            {PARTS.filter((p) => p.region).length} body regions drawn; {live.length} carry an injury this season.
          </p>
        </div>
      </div>
    </section>
  );
}

function Legend({ mode }: { mode: "plain" | "detailed" }) {
  const swatches: { label: string; style: CSSProperties }[] = [
    { label: wordFor(mode, "legendClear"), style: { background: "var(--skin)", border: "1px solid var(--line-strong)" } },
    { label: wordFor(mode, "legendPast"), style: { background: "var(--out)", opacity: 0.5 } },
    { label: wordFor(mode, "legendCurrent"), style: { background: "var(--out)" } },
  ];
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {swatches.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5">
          <span aria-hidden className="block h-2.5 w-2.5 shrink-0" style={s.style} />
          <span className="text-[12px] tracking-wide text-ink-dim sm:text-[11px]">{s.label}</span>
        </li>
      ))}
    </ul>
  );
}

// partKey is re-exported for tests that need to address a part the way the map does
export { partKey };
