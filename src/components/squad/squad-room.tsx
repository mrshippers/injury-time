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
import { Crest } from "@/components/club/crest";
import dynamic from "next/dynamic";
import { useEffect, useEffectEvent, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";

import type { SquadRow } from "@/lib/data";
import { FORMATIONS, formationByName, isAvailable, pickXI } from "@/lib/lineup";
import { saveLineupAction } from "@/lib/squad/actions";
import { positionKnown } from "@/lib/squad/position";
import type { CallStatus, Fixture, Position, SavedLineup } from "@/lib/types";

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
  /** the side named for the last match: the default for this one */
  previous: SavedLineup | null;
  /** who has answered for this match; anyone who said out is left out */
  calls: Record<string, CallStatus>;
  clubId: string;
  canManage: boolean;
  canPick: boolean;
};

export function SquadRoom({ rows, nextFixture, saved, previous, calls, clubId, canManage, canPick }: SquadRoomProps) {
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
  // the side fills itself: last match's eleven again, who said out swapped for the next best, who said in first
  // the club captain (set on the player, e.g. Belstone's) is always the first name on the sheet
  const clubCaptain = useMemo(() => rows.find((r) => (r.player.external_stats as { captain?: boolean } | null)?.captain && isAvailable(r))?.player.id ?? null, [rows]);
  const prefer = useMemo(() => new Set([...((previous?.xi ?? []).filter(Boolean) as string[]), ...(clubCaptain ? [clubCaptain] : [])]), [previous, clubCaptain]);
  const callMap = useMemo(() => new Map(Object.entries(calls)), [calls]);
  const auto = useMemo(() => pickXI(rows, formation, { prefer, calls: callMap }).picks.map((p) => p.row?.player.id ?? null), [rows, formation, prefer, callMap]);
  const [manualState, setManual] = useState<{ formation: string; ids: (string | null)[] } | null>(
    saved ? { formation: saved.formation, ids: saved.xi } : null,
  );
  // an unsaved draft survives a refresh: the lads should not have to rebuild a side because the page reloaded
  const draftKey = `injury-time.draft.${clubId}.${nextFixture?.id ?? "none"}`;
  const storedDraft = useStoredValue(draftKey);
  const draft = useMemo(() => {
    if (saved || !storedDraft) return null;
    try {
      const d = JSON.parse(storedDraft) as { formation: string; ids: (string | null)[] };
      return typeof d?.formation === "string" && Array.isArray(d.ids) && d.ids.length === 11 ? d : null;
    } catch {
      return null;
    }
  }, [storedDraft, saved]);
  const manual = manualState ?? draft;
  useEffect(() => {
    if (!manualState || saved) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify(manualState));
    } catch {}
  }, [manualState, saved, draftKey]);
  const xiIds = manual && manual.formation === formation.name ? manual.ids : auto;
  const setXiIds = (update: (ids: (string | null)[]) => (string | null)[]) => {
      setManual({ formation: formation.name, ids: update(manual && manual.formation === formation.name ? manual.ids : auto) });
    };

  const inXI = useMemo(() => new Set(xiIds.filter(Boolean) as string[]), [xiIds]);
  const slotOf = useMemo(() => new Map(xiIds.flatMap((id, i) => (id ? [[id, formation.slots[i]] as const] : []))), [xiIds, formation]);
  // depth against the formation: what it asks for, who is fit and placed there, who has no position yet
  const depth = useMemo(() => {
    const need: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
    for (const sl of formation.slots) need[sl.role] += 1;
    const have: Record<Position, number> = { GK: 0, DF: 0, MF: 0, FW: 0 };
    let unset = 0;
    for (const r of rows) {
      if (!isAvailable(r) || calls[r.player.id] === "out") continue;
      if (positionKnown(r.player)) have[r.player.position] += 1;
      else unset += 1;
    }
    return { need, have, unset };
  }, [rows, formation, calls]);
  const bench = useMemo(() => rows.filter((r) => isAvailable(r) && !inXI.has(r.player.id)), [rows, inXI]);
  const filled = xiIds.filter(Boolean).length;

  // the captain: picked here, saved with the side; last match's captain carries over while he's in the eleven
  const [captainState, setCaptainState] = useState<string | null | undefined>(undefined);
  const captainPick = captainState !== undefined ? captainState : (saved?.captain ?? previous?.captain ?? clubCaptain);
  const captain = captainPick && xiIds.includes(captainPick) ? captainPick : null;
  const toggleCaptain = (id: string) => setCaptainState(captain === id ? null : id);

  const [savedState, setSavedState] = useState<{ formation: string; xi: (string | null)[]; captain: string | null } | null>(
    saved ? { formation: saved.formation, xi: saved.xi, captain: saved.captain ?? null } : null,
  );
  const dirty = !savedState || savedState.formation !== formation.name || savedState.xi.join("|") !== xiIds.join("|") || savedState.captain !== captain;
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
  const clearSide = () => setXiIds((ids) => ids.map(() => null));
  // where the side on the pitch came from, said once and plainly
  const carried = !manual || manual.formation !== formation.name ? xiIds.filter((id) => id && prefer.has(id)).length : 0;
  const origin =
    manual && manual.formation === formation.name
      ? null
      : prefer.size > 0
        ? `filled from last match's eleven${carried < 11 ? `, ${11 - carried} change${11 - carried === 1 ? "" : "s"} for who is out` : ""}`
        : "filled from who is in and who has played most";

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
      setToggleNote("the starting XI is full, take someone out first");
      return;
    }
    place(playerId, slot);
    setToggleNote(null);
  };

  const save = () => {
    if (!nextFixture) return;
    const benchIds = bench.map((r) => r.player.id);
    startSave(async () => {
      const res = await saveLineupAction({ fixtureId: nextFixture.id, formation: formation.name, xi: xiIds, bench: benchIds, captain });
      if (res.ok) {
        setSavedState({ formation: formation.name, xi: xiIds, captain });
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
        className="segmented sticky top-[var(--nav-h)] z-20 -mx-4 grid grid-cols-2 border-b border-line bg-pitch/95 px-4 py-2 backdrop-blur-md lg:hidden"
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
              className={`pressable plate num h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.05em] transition-colors duration-[190ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint ${
                on ? "bg-panel-2 text-ink shadow-[inset_0_-2px_0_var(--mint)]" : "text-ink-dim"
              }`}
            >
              {v === "squad" ? `squad · ${rows.length}` : `starting XI · ${filled}/11`}
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
        {/* depth only means something once most of the squad has a position; until then it is a row of "short" */}
        {depth.unset * 2 < depth.unset + Object.values(depth.have).reduce((a, b) => a + b, 0) ? <DepthLine depth={depth} formation={formation.name} /> : null}
        <SquadList
          rows={rows}
          inXI={inXI}
          slotOf={slotOf}
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
              onClick={clearSide}
              disabled={filled === 0}
              className="pressable h-8 px-2 text-[12px] font-semibold text-ink-dim underline-offset-4 hover:text-ink hover:underline disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
            >
              clear
            </button>
            {canPick && nextFixture ? (
              <button
                type="button"
                onClick={save}
                disabled={!dirty || saving}
                aria-live="polite"
                className={`pressable plate h-8 text-[12px] font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:opacity-60 ${
                  dirty ? "bg-mint text-mint-ink" : "bg-panel-2 text-ink-dim"
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
        {origin ? <p className="mt-2 text-[12px] text-ink-dim">{origin}. Swap anyone, it saves when you do.</p> : null}

        <div
          ref={pitchBox}
          className="relative mt-3 aspect-[4/5] w-full overflow-hidden bg-panel sm:aspect-[16/11]"
          data-testid="pitch"
          data-drag={drag ? drag.kind : undefined}
        >
          {/* a hidden canvas still renders every frame; on a phone it only mounts on its own screen */}
          {tokens && (!phone || view === "side") ? (
            <PitchScene
              formation={formation}
              xiIds={xiIds}
              byId={byId}
              captainId={captain}
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
            <p className="pointer-events-none absolute left-3 top-3 flex items-center gap-2 text-[11.5px] text-ink-dim">
              <span className="num text-gold">{shortDate(nextFixture.match_date).toUpperCase()}</span>
              <span aria-hidden>·</span>
              <Crest team={nextFixture.opponent} size={16} plain />
              <span>
                {nextFixture.opponent} ({nextFixture.venue})
              </span>
            </p>
          ) : null}
          <p className="pointer-events-none absolute bottom-3 left-3 text-[10.5px] tracking-[0.12em] uppercase text-ink-dim">
            {phone ? "attacking ↑ · tap a shirt · drag to orbit" : "own goal ↓ · attacking ↑ · drag to orbit"}
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
          captainId={captain}
          onCaptain={canPick ? toggleCaptain : undefined}
        />
      </section>

      {/* the ghost that follows a list drag */}
      <div
        ref={ghost}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform"
        style={{ display: drag?.kind === "list" && ghostRow ? "block" : "none" }}
      >
        <span className="num -translate-x-1/2 -translate-y-[130%] whitespace-nowrap plate plate-sm border-mint bg-panel px-2.5 py-1.5 text-[12px] font-bold text-ink shadow-[0_8px_24px_rgba(0,0,0,0.55)]">
          {ghostRow?.player.squad_number ?? ""} {ghostRow?.player.name.split(" ").at(-1)}
        </span>
      </div>
      <span className="sr-only">{FORMATIONS.length} formations available</span>
    </div>
  );
}

/**
 * Depth against the formation, one line: what it asks for at each position against who is fit, has not
 * said out, and has that position set. Short is a hollow square and the word, covered a filled one; the
 * players with no position yet are counted out loud, so a bare "0" never reads as nobody.
 */
function DepthLine({ depth, formation }: { depth: { need: Record<Position, number>; have: Record<Position, number>; unset: number }; formation: string }) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line py-2" aria-label={`depth for ${formation}`}>
      <span className="annot text-[10.5px]">{`// depth for ${formation}`}</span>
      {(["GK", "DF", "MF", "FW"] as const).map((p) => {
        const short = depth.have[p] < depth.need[p];
        return (
          <span key={p} className="num inline-flex items-center gap-1.5 text-[11.5px] text-ink">
            <span aria-hidden className={`inline-block size-2 ${short ? "border border-ink-dim" : "bg-ink"}`} />
            {p} <span className="tabular-nums">{depth.have[p]}</span>
            <span className="text-ink-dim">of {depth.need[p]}</span>
            {short ? <span className="text-[10px] uppercase tracking-[0.1em] text-doubt">short</span> : null}
          </span>
        );
      })}
      {depth.unset > 0 ? <span className="num text-[11.5px] text-ink-dim">{depth.unset} with no position set</span> : null}
    </div>
  );
}
