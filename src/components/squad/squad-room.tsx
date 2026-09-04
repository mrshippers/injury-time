"use client";

/**
 * The squad room, FM layout: the list on the left, the pitch on the right.
 *
 * One state owns the side: the formation, the eleven ids in slot order, and
 * whether that differs from what is saved for the fixture. Placing a player
 * has three routes that all end in the same reducer: drag him from the list
 * onto a slot, drag a token between slots, or select a name and then a slot
 * (keyboard and touch). Nothing on the pitch is the only way to do anything.
 */
import dynamic from "next/dynamic";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";

import type { SquadRow } from "@/lib/data";
import { FORMATIONS, fillEmpty, formationByName, isAvailable, pickXI } from "@/lib/lineup";
import { saveLineupAction } from "@/lib/squad/actions";
import type { Fixture, SavedLineup } from "@/lib/types";

import { useIsPhone, useReducedMotion, useSceneTokens, useStoredValue } from "@/components/three/tokens";
import type { DragSource } from "@/components/lineup/pitch-scene";
import { FormationSelect } from "./formation-select";
import { AddPlayerForm } from "./player-forms";
import { SquadList } from "./squad-list";
import { XiStrip } from "./xi-strip";
import { shortDate } from "./format";

const PitchScene = dynamic(() => import("@/components/lineup/pitch-scene"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-panel" aria-hidden />,
});

const STORAGE_KEY = "injury-time.formation";
const VIEW_KEY = "injury-time.squad-view";
const VIEW_EVENT = "injury-time:squad-view";
type View = "squad" | "side";
function readView(): View | null {
  try {
    const v = sessionStorage.getItem(VIEW_KEY);
    return v === "squad" || v === "side" ? v : null;
  } catch {
    return null;
  }
}
function subscribeView(cb: () => void) {
  window.addEventListener(VIEW_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(VIEW_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export type SquadRoomProps = {
  rows: SquadRow[];
  nextFixture: Fixture | null;
  saved: SavedLineup | null;
  canManage: boolean;
  canPick: boolean;
};

export function SquadRoom({ rows, nextFixture, saved, canManage, canPick }: SquadRoomProps) {
  const tokens = useSceneTokens();
  const reduced = useReducedMotion();
  const phone = useIsPhone();
  const stored = useStoredValue(STORAGE_KEY);

  /* ── on a phone the room is two screens: the squad, and the side ── */
  const storedView = useSyncExternalStore(subscribeView, readView, () => null);
  const view: View = storedView ?? (saved ? "side" : "squad");
  const chooseView = (v: View) => {
    try {
      sessionStorage.setItem(VIEW_KEY, v);
    } catch {}
    window.dispatchEvent(new Event(VIEW_EVENT));
  };
  const byId = useMemo(() => new Map(rows.map((r) => [r.player.id, r])), [rows]);

  /* ── the side ── */
  const [chosen, setChosen] = useState<string | null>(null);
  const formation = formationByName(chosen ?? saved?.formation ?? stored);
  const auto = useMemo(() => pickXI(rows, formation).picks.map((p) => p.row?.player.id ?? null), [rows, formation]);
  const [manual, setManual] = useState<{ formation: string; ids: (string | null)[] } | null>(
    saved ? { formation: saved.formation, ids: saved.xi } : null,
  );
  const xiIds = manual && manual.formation === formation.name ? manual.ids : auto;
  const setXiIds = (update: (ids: (string | null)[]) => (string | null)[]) => {
      setManual((m) => ({ formation: formation.name, ids: update(m && m.formation === formation.name ? m.ids : auto) }));
    };

  const inXI = useMemo(() => new Set(xiIds.filter(Boolean) as string[]), [xiIds]);
  const bench = useMemo(() => rows.filter((r) => isAvailable(r) && !inXI.has(r.player.id)), [rows, inXI]);
  const filled = xiIds.filter(Boolean).length;

  const [savedState, setSavedState] = useState<{ formation: string; xi: (string | null)[] } | null>(
    saved ? { formation: saved.formation, xi: saved.xi } : null,
  );
  const dirty = !savedState || savedState.formation !== formation.name || savedState.xi.join("|") !== xiIds.join("|");
  const [saving, startSave] = useTransition();
  const [saveNote, setSaveNote] = useState<string | null>(null);

  const chooseFormation = (name: string) => {
    setChosen(name);
    setSelectedSlot(null);
    try {
      localStorage.setItem(STORAGE_KEY, name);
    } catch {}
  };

  const place = (playerId: string, slot: number) => {
      setXiIds((ids) => {
        const next = ids.map((id) => (id === playerId ? null : id));
        next[slot] = playerId;
        return next;
      });
    };
  const swap = (a: number, b: number) => {
      setXiIds((ids) => {
        const next = [...ids];
        [next[a], next[b]] = [next[b], next[a]];
        return next;
      });
    };
  const remove = (slot: number) => {
      setXiIds((ids) => {
        const next = [...ids];
        next[slot] = null;
        return next;
      });
    };
  const pickForMe = () => setXiIds((ids) => fillEmpty(rows, formation, ids));

  /* ── one tap from the list: in he goes, to the first slot that fits him ── */
  const [toggleNote, setToggleNote] = useState<string | null>(null);
  const toggleIn = (playerId: string) => {
    const row = byId.get(playerId);
    if (!row) return;
    if (inXI.has(playerId)) {
      setXiIds((ids) => ids.map((id) => (id === playerId ? null : id)));
      setToggleNote(null);
      return;
    }
    const empties = xiIds.map((id, i) => (id ? -1 : i)).filter((i) => i >= 0);
    const fits = empties.find((i) => formation.slots[i].role === row.player.position);
    const slot = fits ?? empties[0];
    if (slot === undefined) {
      setToggleNote("the side is full, take someone out first");
      return;
    }
    place(playerId, slot);
    setToggleNote(null);
  };

  const save = () => {
    if (!nextFixture) return;
    const benchIds = bench.map((r) => r.player.id);
    startSave(async () => {
      const res = await saveLineupAction({ fixtureId: nextFixture.id, formation: formation.name, xi: xiIds, bench: benchIds });
      if (res.ok) {
        setSavedState({ formation: formation.name, xi: xiIds });
        setSaveNote("saved");
      } else {
        setSaveNote(res.error);
      }
    });
  };

  /* ── selection: a name, then a slot; or a slot, then a slot ── */
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const onSelectSlot = (i: number) => {
      if (selectedPlayer) {
        place(selectedPlayer, i);
        setSelectedPlayer(null);
        setSelectedSlot(null);
        return;
      }
      if (selectedSlot === null) {
        setSelectedSlot(i);
        return;
      }
      if (selectedSlot === i) {
        setSelectedSlot(null);
        return;
      }
      swap(selectedSlot, i);
      setSelectedSlot(null);
    };
  const onSelectPlayer = (id: string) => {
      if (selectedSlot !== null) {
        place(id, selectedSlot);
        setSelectedSlot(null);
        setSelectedPlayer(null);
        return;
      }
      setSelectedPlayer((cur) => (cur === id ? null : id));
    };
  const clearSelection = () => {
    setSelectedPlayer(null);
    setSelectedSlot(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedPlayer(null);
        setSelectedSlot(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── drag: the room owns the pointer, the scene owns the ground ── */
  const [drag, setDrag] = useState<DragSource | null>(null);
  const dragRef = useRef<DragSource | null>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const pitchBox = useRef<HTMLDivElement>(null);

  const onDragOver = (i: number | null) => {
    dragOverRef.current = i;
    setDragOver(i);
  };

  const endDrag = () => {
    const source = dragRef.current;
    const over = dragOverRef.current;
    if (source) {
      if (source.kind === "list") {
        if (over !== null) place(source.playerId, over);
      } else if (over !== null && over !== source.index) {
        swap(source.index, over);
      } else if (over === null) {
        const box = pitchBox.current?.getBoundingClientRect();
        const { x, y } = pointer.current;
        const outside = !box || x < box.left || x > box.right || y < box.top || y > box.bottom;
        if (outside) remove(source.index);
      }
    }
    dragRef.current = null;
    dragOverRef.current = null;
    setDrag(null);
    setDragOver(null);
    document.body.style.cursor = "";
    document.body.classList.remove("select-none");
  };

  const startDrag = (source: DragSource, e: PointerEvent) => {
      dragRef.current = source;
      pointer.current = { x: e.clientX, y: e.clientY };
      setDrag(source);
      setSelectedPlayer(null);
      setSelectedSlot(null);
      document.body.style.cursor = "grabbing";
      document.body.classList.add("select-none");
      if (ghost.current) ghost.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    };

  // the latest endDrag, without re-subscribing the window on every render
  const onDragEnd = useEffectEvent(() => endDrag());
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY };
      if (ghost.current) ghost.current.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    };
    const up = () => onDragEnd();
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [drag]);

  const ghostRow = drag?.kind === "list" ? byId.get(drag.playerId) : drag?.kind === "slot" && xiIds[drag.index] ? byId.get(xiIds[drag.index]!) : null;

  const status =
    drag
      ? dragOver !== null
        ? `drop him at ${formation.slots[dragOver].role}`
        : drag.kind === "slot"
          ? "drop off the pitch to take him out"
          : "drag him onto a slot"
      : selectedPlayer
        ? "now pick the slot he goes in"
        : selectedSlot !== null
          ? "now pick a name, or another slot to swap"
          : filled === 11
            ? "XI picked"
            : `${filled} of 11 · ${11 - filled} slot${11 - filled === 1 ? "" : "s"} empty`;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,620px)_minmax(0,1fr)] lg:items-start">
      {/* phone: two screens, one thumb */}
      <div
        role="tablist"
        aria-label="squad room view"
        className="sticky top-12 z-20 -mx-4 grid grid-cols-2 border-b border-line bg-pitch/95 px-4 py-2 backdrop-blur-md lg:hidden"
      >
        {(["squad", "side"] as const).map((v) => {
          const on = view === v;
          return (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => chooseView(v)}
              className={`pressable h-11 border text-[13px] font-semibold tracking-[0.06em] transition-colors duration-[190ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint ${
                on ? "border-mint bg-mint text-mint-ink" : "border-line bg-panel text-ink-dim"
              } ${v === "squad" ? "rounded-l-[2px]" : "rounded-r-[2px] border-l-0"}`}
            >
              {v === "squad" ? `squad · ${rows.length}` : `the side · ${filled}/11`}
            </button>
          );
        })}
      </div>

      {/* the list */}
      <section aria-label="squad list" className={`min-w-0 ${view === "squad" ? "" : "hidden lg:block"}`}>
        {canManage ? <AddPlayerForm /> : null}
        {toggleNote ? (
          <p className="mb-2 text-[12.5px] text-doubt lg:hidden" role="status">
            {toggleNote}
          </p>
        ) : null}
        <SquadList
          rows={rows}
          inXI={inXI}
          selectedPlayer={selectedPlayer}
          dragging={drag !== null}
          canManage={canManage}
          onSelect={onSelectPlayer}
          onToggleIn={toggleIn}
          onDragStart={(playerId, e) => startDrag({ kind: "list", playerId }, e)}
        />
      </section>

      {/* the pitch */}
      <section aria-label="pitch" className={`min-w-0 lg:sticky lg:top-16 ${view === "side" ? "" : "hidden lg:block"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <FormationSelect value={formation.name} onChange={chooseFormation} />
            <button
              type="button"
              onClick={pickForMe}
              disabled={filled === 11}
              className="pressable h-8 border border-line bg-panel-2 px-3 text-[12px] font-semibold text-ink-dim hover:text-ink disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              pick for me
            </button>
            {canPick && nextFixture ? (
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                aria-live="polite"
                className={`pressable h-8 px-3 text-[12px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:opacity-60 ${
                  dirty ? "bg-mint text-mint-ink" : "border border-line bg-panel-2 text-ink-dim"
                }`}
              >
                {saving ? "saving" : dirty ? `save for ${shortDate(nextFixture.match_date)}` : "saved"}
              </button>
            ) : null}
            {saveNote && saveNote !== "saved" ? <span className="text-[12px] text-out">{saveNote}</span> : null}
          </div>
          <p className="num text-[11.5px] text-ink-dim" aria-live="polite">
            {status}
          </p>
        </div>

        <div
          ref={pitchBox}
          className="relative mt-3 aspect-[4/5] w-full overflow-hidden border border-line bg-panel sm:aspect-[16/11]"
          data-testid="pitch"
          data-drag={drag ? drag.kind : undefined}
        >
          {tokens ? (
            <PitchScene
              formation={formation}
              xiIds={xiIds}
              byId={byId}
              tokens={tokens}
              reduced={reduced}
              compact={phone}
              selected={selectedSlot}
              hovered={hovered}
              drag={drag}
              pointer={pointer}
              dragOver={dragOver}
              onDragOver={onDragOver}
              onDragStart={startDrag}
              onHover={setHovered}
              onSelect={onSelectSlot}
              onClear={clearSelection}
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
            {phone ? "attacking ↑ · tap a shirt · drag to orbit" : "own goal ↓ · attacking ↑ · drag to orbit, scroll to zoom"}
          </p>
        </div>

        <XiStrip
          formation={formation}
          xiIds={xiIds}
          byId={byId}
          bench={bench}
          selectedSlot={selectedSlot}
          hovered={hovered}
          onHover={setHovered}
          onSelectSlot={onSelectSlot}
          onRemove={remove}
        />
      </section>

      {/* the ghost that follows a list drag */}
      <div
        ref={ghost}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform"
        style={{ display: drag?.kind === "list" && ghostRow ? "block" : "none" }}
      >
        <span className="num -translate-x-1/2 -translate-y-[130%] whitespace-nowrap border border-mint bg-panel px-2.5 py-1.5 text-[12px] font-bold text-ink shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
          {ghostRow?.player.squad_number ?? ""} {ghostRow?.player.name.split(" ").at(-1)}
        </span>
      </div>
      <span className="sr-only">{FORMATIONS.length} formations available</span>
    </div>
  );
}
