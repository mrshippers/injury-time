"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { SquadRow } from "@/lib/data";
import { FORMATIONS, byForm, isAvailable, pickXI, type Pick } from "@/lib/lineup";
import { READINESS_TEXT } from "@/lib/readiness";
import type { Fixture } from "@/lib/types";

import { useReducedMotion, useSceneTokens, useStoredValue } from "@/components/three/tokens";
import { STATUS_LABEL, shortDate } from "@/components/squad/format";

const PitchScene = dynamic(() => import("./pitch-scene"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-panel" aria-hidden />,
});

const STORAGE_KEY = "injury-time.formation";

/**
 * The lineup board: formation on the left in 3D, the lists on the right.
 * The auto-pick is a starting point, never the answer: click a shirt on the
 * pitch, then a name on the bench (or another shirt) and they swap.
 */
export function LineupBoard({ rows, nextFixture }: { rows: SquadRow[]; nextFixture: Fixture | null }) {
  const tokens = useSceneTokens();
  const reduced = useReducedMotion();
  // remembered formation, per browser: a convenience, not a record
  const saved = useStoredValue(STORAGE_KEY);
  const [chosen, setChosen] = useState<string | null>(null);
  const formationIdx = Math.max(0, FORMATIONS.findIndex((f) => f.name === (chosen ?? saved)));
  const formation = FORMATIONS[formationIdx];
  const byId = useMemo(() => new Map(rows.map((r) => [r.player.id, r])), [rows]);

  // the auto-pick is derived; manual swaps are an override that only applies
  // to the formation it was made in, so changing shape re-picks cleanly
  const auto = useMemo(() => pickXI(rows, formation).picks.map((p) => p.row?.player.id ?? null), [rows, formation]);
  const [manual, setManual] = useState<{ formation: string; ids: (string | null)[] } | null>(null);
  const xiIds = manual && manual.formation === formation.name ? manual.ids : auto;
  const setXiIds = useCallback(
    (update: (ids: (string | null)[]) => (string | null)[]) => {
      setManual((m) => ({
        formation: formation.name,
        ids: update(m && m.formation === formation.name ? m.ids : auto),
      }));
    },
    [formation.name, auto],
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const picks: Pick[] = useMemo(
    () =>
      formation.slots.map((slot, i) => {
        const row = xiIds[i] ? (byId.get(xiIds[i]!) ?? null) : null;
        return { slot, row, outOfPosition: !!row && row.player.position !== slot.role };
      }),
    [formation, xiIds, byId],
  );

  const inXI = useMemo(() => new Set(xiIds.filter(Boolean) as string[]), [xiIds]);
  const bench = useMemo(() => rows.filter((r) => isAvailable(r) && !inXI.has(r.player.id)).sort(byForm), [rows, inXI]);
  const unavailable = useMemo(() => rows.filter((r) => !isAvailable(r)), [rows]);
  const filled = picks.filter((p) => p.row).length;
  const borrowed = picks.filter((p) => p.outOfPosition).length;

  const chooseFormation = (i: number) => {
    setChosen(FORMATIONS[i].name);
    setSelected(null);
    try {
      localStorage.setItem(STORAGE_KEY, FORMATIONS[i].name);
    } catch {}
  };

  /** Click a slot: select it, or swap with the already-selected slot. */
  const onSelectSlot = useCallback(
    (i: number) => {
      if (selected === null) {
        setSelected(i);
        return;
      }
      if (selected === i) {
        setSelected(null);
        return;
      }
      const cur = selected;
      setXiIds((ids) => {
        const next = [...ids];
        [next[cur], next[i]] = [next[i], next[cur]];
        return next;
      });
      setSelected(null);
    },
    [selected, setXiIds],
  );

  /** Click a bench name: fill the selected slot with him (old occupant to bench). */
  const onBench = (playerId: string) => {
    if (selected === null) return;
    const slot = selected;
    setXiIds((ids) => {
      const next = [...ids];
      next[slot] = playerId;
      return next;
    });
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
      <section aria-label="pitch" className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
          <div role="group" aria-label="formation" className="flex overflow-hidden rounded-[3px] border border-line">
            {FORMATIONS.map((f, i) => (
              <button
                key={f.name}
                type="button"
                aria-pressed={i === formationIdx}
                onClick={() => chooseFormation(i)}
                className={`pressable num h-8 px-3 text-[12.5px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
                  i === formationIdx ? "bg-mint text-mint-ink" : "bg-panel-2 text-ink-dim hover:text-ink"
                }`}
              >
                {f.name}
              </button>
            ))}
          </div>
          <p className="num text-[11.5px] text-ink-dim" aria-live="polite">
            {selected === null
              ? filled === 11
                ? `XI picked${borrowed ? ` · ${borrowed} out of position` : ""}`
                : `${filled} of 11 · ${11 - filled} slot${11 - filled === 1 ? "" : "s"} empty`
              : "now pick who goes there"}
          </p>
        </div>
        <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden border border-line bg-panel sm:aspect-[16/11]" data-testid="pitch">
          {tokens ? (
            <PitchScene
              picks={picks}
              tokens={tokens}
              selected={selected}
              hovered={hovered}
              reduced={reduced}
              onHover={setHovered}
              onSelect={onSelectSlot}
              onClear={() => setSelected(null)}
            />
          ) : null}
          {nextFixture ? (
            <p className="pointer-events-none absolute left-3 top-3 text-[11.5px] text-ink-dim">
              <span className="num text-gold">{shortDate(nextFixture.match_date).toUpperCase()}</span>
              {" · "}
              {nextFixture.opponent} ({nextFixture.venue})
            </p>
          ) : null}
          <p className="pointer-events-none absolute bottom-3 left-3 text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">
            own goal ↓ · attacking ↑
          </p>
        </div>
      </section>

      <aside className="flex flex-col gap-4">
        <section aria-labelledby="xi-heading" className="border border-line bg-panel">
          <p className="annot border-b border-line px-4 py-2" id="xi-heading">{"// the eleven"}</p>
          <ol>
            {picks.map((p, i) => (
              <li key={i}>
                <button
                  type="button"
                  aria-pressed={selected === i}
                  onClick={() => onSelectSlot(i)}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  className={`pressable flex w-full items-center gap-3 border-b border-line px-4 py-1.5 text-left transition-colors duration-[190ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint ${
                    selected === i ? "bg-panel-2" : hovered === i ? "bg-panel-2/60" : "hover:bg-panel-2/60"
                  }`}
                >
                  <span className="num w-6 shrink-0 text-[10.5px] tracking-[0.08em] text-ink-dim">{p.slot.role}</span>
                  <span className="num w-5 shrink-0 text-right text-[12px] text-ink-dim">{p.row?.player.squad_number ?? ""}</span>
                  <span className={`min-w-0 flex-1 truncate text-[13px] ${p.row ? "text-ink" : "text-out"}`}>
                    {p.row ? p.row.player.name : "nobody available"}
                    {p.outOfPosition ? <span className="annot ml-2 !text-[9.5px] text-gold">{p.row!.player.position}</span> : null}
                  </span>
                  {p.row ? (
                    <span className={`num shrink-0 text-[10px] font-semibold tracking-[0.08em] ${READINESS_TEXT[p.row.readiness.key]}`}>
                      {p.row.readiness.word.toUpperCase()}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="bench-heading" className="border border-line bg-panel">
          <p className="annot flex items-baseline justify-between border-b border-line px-4 py-2" id="bench-heading">
            <span>{"// bench"}</span>
            <span className="num text-gold-dim">{bench.length}</span>
          </p>
          {bench.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-ink-dim">Nobody spare. Everyone fit is on the pitch.</p>
          ) : (
            <ul>
              {bench.map((r) => (
                <li key={r.player.id}>
                  <button
                    type="button"
                    disabled={selected === null}
                    onClick={() => onBench(r.player.id)}
                    className={`pressable flex w-full items-center gap-3 border-b border-line px-4 py-1.5 text-left transition-colors duration-[190ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint ${
                      selected === null ? "cursor-default" : "hover:bg-panel-2/60"
                    }`}
                    title={selected === null ? "pick a slot on the pitch first" : `put ${r.player.name} in`}
                  >
                    <span className="num w-6 shrink-0 text-[10.5px] tracking-[0.08em] text-ink-dim">{r.player.position}</span>
                    <span className="num w-5 shrink-0 text-right text-[12px] text-ink-dim">{r.player.squad_number ?? ""}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{r.player.name}</span>
                    <span className={`num shrink-0 text-[10px] font-semibold tracking-[0.08em] ${READINESS_TEXT[r.readiness.key]}`}>
                      {r.readiness.word.toUpperCase()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="unavail-heading" className="border border-line bg-panel">
          <p className="annot flex items-baseline justify-between border-b border-line px-4 py-2" id="unavail-heading">
            <span>{"// not available"}</span>
            <span className="num text-gold-dim">{unavailable.length}</span>
          </p>
          {unavailable.length === 0 ? (
            <p className="px-4 py-3 text-[12.5px] text-ink-dim">Full squad. Enjoy it, it will not last.</p>
          ) : (
            <ul>
              {unavailable.map((r) => {
                const a = r.availability!;
                return (
                  <li key={r.player.id}>
                    <Link
                      href={`/player/${r.player.id}`}
                      className="pressable flex items-center gap-3 border-b border-line px-4 py-1.5 hover:bg-panel-2/60"
                    >
                      <span className="num w-6 shrink-0 text-[10.5px] tracking-[0.08em] text-ink-dim">{r.player.position}</span>
                      <span className="num w-5 shrink-0 text-right text-[12px] text-ink-dim">{r.player.squad_number ?? ""}</span>
                      <span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">{r.player.name}</span>
                      <span
                        className={`num shrink-0 text-[10px] font-semibold tracking-[0.08em] ${
                          a.status === "doubt" ? "text-doubt" : a.status === "suspended" ? "text-susp" : "text-out"
                        }`}
                      >
                        {STATUS_LABEL[a.status]}
                        {a.return_date ? <span className="ml-1.5 font-normal text-ink-dim">{shortDate(a.return_date)}</span> : null}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
