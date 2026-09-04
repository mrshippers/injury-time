"use client";

/**
 * The board, FM-dense: one row per player, every column sortable, three
 * filters and a search. A row is a drag source (the whole row with a mouse,
 * the grip on touch so the list still scrolls) and a select target for the
 * keyboard route. The name stays a link to the profile.
 */
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { SquadRow } from "@/lib/data";
import { READINESS_RANK, READINESS_TEXT, type ReadinessKey } from "@/lib/readiness";
import type { AvailabilityStatus, ExternalStats, Position } from "@/lib/types";

import { ConditionBar } from "./condition-bar";
import { EditPlayerRow, SetPositionControl } from "./player-forms";
import { StatusPill } from "./status-pill";
import { StatusMenu } from "./status-menu";

type SortKey = "number" | "name" | "position" | "status" | "training" | "played" | "goals";
type Dir = "asc" | "desc";
const STATUS_ORDER: Record<AvailabilityStatus, number> = { fit: 0, doubt: 1, suspended: 2, injured: 3 };
const POSITION_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 };
const READINESS_FILTERS: { value: ReadinessKey | "all"; label: string }[] = [
  { value: "all", label: "any training" },
  { value: "steady", label: "steady" },
  { value: "pushing", label: "pushing it" },
  { value: "undercooked", label: "undercooked" },
  { value: "red", label: "red zone" },
  { value: "unknown", label: "no reading" },
];

function played(r: SquadRow): number {
  return r.stats.apps || (r.player.external_stats as ExternalStats | null)?.apps || 0;
}
function goals(r: SquadRow): number {
  return r.stats.goals || (r.player.external_stats as ExternalStats | null)?.goals || 0;
}
function statusOf(r: SquadRow): AvailabilityStatus {
  return r.availability?.status ?? "fit";
}
function positionConfirmed(r: SquadRow): boolean {
  const s = r.player.external_stats as (ExternalStats & { position_confirmed?: boolean }) | null;
  return s?.position_confirmed !== false;
}

const HEAD = "annot sticky top-0 z-20 border-b border-line-strong bg-panel px-2 py-1.5 text-left font-normal";
const CELL = "px-2 align-middle";
const SELECT =
  "num h-7 border border-line-strong bg-panel px-1.5 text-[11.5px] text-ink [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint";

export function SquadList({
  rows,
  inXI,
  selectedPlayer,
  dragging,
  canManage,
  onSelect,
  onToggleIn,
  onDragStart,
}: {
  rows: SquadRow[];
  inXI: Set<string>;
  selectedPlayer: string | null;
  dragging: boolean;
  canManage: boolean;
  onSelect: (id: string) => void;
  /** phone route: one tap puts him in the side or takes him out */
  onToggleIn?: (id: string) => void;
  onDragStart: (playerId: string, e: PointerEvent) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: Dir }>({ key: "number", dir: "asc" });
  const [position, setPosition] = useState<Position | "all">("all");
  const [status, setStatus] = useState<AvailabilityStatus | "all">("all");
  const [readiness, setReadiness] = useState<ReadinessKey | "all">("all");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<string | null>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = rows.filter(
      (r) =>
        (position === "all" || r.player.position === position) &&
        (status === "all" || statusOf(r) === status) &&
        (readiness === "all" || r.readiness.key === readiness) &&
        (needle === "" || r.player.name.toLowerCase().includes(needle)),
    );
    const cmp = (a: SquadRow, b: SquadRow): number => {
      switch (sort.key) {
        case "number":
          return (a.player.squad_number ?? 99) - (b.player.squad_number ?? 99);
        case "name":
          return a.player.name.localeCompare(b.player.name);
        case "position":
          return POSITION_ORDER[a.player.position] - POSITION_ORDER[b.player.position];
        case "status":
          return STATUS_ORDER[statusOf(a)] - STATUS_ORDER[statusOf(b)];
        case "training":
          return READINESS_RANK[a.readiness.key] - READINESS_RANK[b.readiness.key];
        case "played":
          return played(b) - played(a);
        case "goals":
          return goals(b) - goals(a);
      }
    };
    const sorted = [...list].sort((a, b) => cmp(a, b) || (a.player.squad_number ?? 99) - (b.player.squad_number ?? 99));
    return sort.dir === "asc" ? sorted : sorted.reverse();
  }, [rows, sort, position, status, readiness, q]);

  const maxLoad = rows.reduce((m, r) => Math.max(m, r.weekLoad), 0);
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  /* press-then-move starts a drag; a plain press is a select */
  const press = useRef<{ id: string; x: number; y: number; pointerId: number } | null>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const p = press.current;
      if (!p || e.pointerId !== p.pointerId) return;
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) {
        press.current = null;
        onDragStart(p.id, e);
      }
    };
    const up = () => {
      press.current = null;
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [onDragStart]);
  const beginPress = (e: React.PointerEvent, id: string, fromGrip: boolean) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    if (e.pointerType === "touch" && !fromGrip) return;
    press.current = { id, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
  };

  return (
    <div className="overflow-x-clip border border-line bg-panel">
      {/* filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-2 py-2">
        <div role="group" aria-label="position" className="flex overflow-hidden border border-line">
          {(["all", "GK", "DF", "MF", "FW"] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={position === p}
              onClick={() => setPosition(p)}
              className={`pressable num h-7 px-2 text-[11px] font-semibold tracking-[0.06em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint ${
                position === p ? "bg-mint text-mint-ink" : "bg-panel-2 text-ink-dim hover:text-ink"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <select aria-label="availability" className={SELECT} value={status} onChange={(e) => setStatus(e.target.value as AvailabilityStatus | "all")}>
          <option value="all">any status</option>
          <option value="fit">fit</option>
          <option value="doubt">doubt</option>
          <option value="injured">out</option>
          <option value="suspended">suspended</option>
        </select>
        <select aria-label="training" className={SELECT} value={readiness} onChange={(e) => setReadiness(e.target.value as ReadinessKey | "all")}>
          {READINESS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label="search the squad"
          placeholder="find a name"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${SELECT} min-w-0 flex-1 placeholder:text-ink-faint`}
        />
      </div>

      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">Squad list: drag a name onto the pitch, or select a name and then a slot.</caption>
        <colgroup>
          <col className="w-9 sm:w-10" />
          <col />
          <col className="w-[46px] sm:w-[58px]" />
          <col className="w-[60px] sm:w-[112px]" />
          <col className="hidden sm:table-column sm:w-[88px]" />
          <col className="hidden sm:table-column sm:w-7" />
          <col className="hidden sm:table-column sm:w-7" />
          <col className="w-[104px] sm:w-[84px]" />
        </colgroup>
        <thead>
          <tr>
            <Th k="number" label="#" align="right" sort={sort} onSort={toggleSort} />
            <Th k="name" label="name" sort={sort} onSort={toggleSort} />
            <Th k="position" label="pos" sort={sort} onSort={toggleSort} />
            <Th k="status" label="status" sort={sort} onSort={toggleSort} />
            <Th k="training" label="training" className="hidden sm:table-cell" sort={sort} onSort={toggleSort} />
            <Th k="played" label="pl" className="hidden sm:table-cell" align="right" sort={sort} onSort={toggleSort} />
            <Th k="goals" label="g" className="hidden sm:table-cell" align="right" sort={sort} onSort={toggleSort} />
            <th scope="col" className={`${HEAD} text-right`}>
              <span className="sr-only">actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const { player } = row;
            const selected = selectedPlayer === player.id;
            const onPitch = inXI.has(player.id);
            return (
              <SquadListRow key={player.id} row={row} selected={selected} onPitch={onPitch} maxLoad={maxLoad} dragging={dragging} canManage={canManage} editing={editing === player.id} onEdit={() => setEditing((e) => (e === player.id ? null : player.id))} onDone={() => setEditing(null)} onSelect={() => onSelect(player.id)} onToggleIn={onToggleIn ? () => onToggleIn(player.id) : undefined} beginPress={beginPress} positionConfirmed={positionConfirmed(row)} />
            );
          })}
        </tbody>
      </table>
      <p className="num border-t border-line px-3 py-1.5 text-[11px] text-ink-dim">
        {shown.length === rows.length ? `${rows.length} in the squad` : `${shown.length} of ${rows.length}`} · {inXI.size} on the pitch
      </p>
      {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-ink-dim">No players yet. Add one above.</p> : null}
    </div>
  );
}

function Th({
  k,
  label,
  className = "",
  align = "left",
  sort,
  onSort,
}: {
  k: SortKey;
  label: string;
  className?: string;
  align?: "left" | "right" | "center";
  sort: { key: SortKey; dir: Dir };
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === k;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`${HEAD} ${className}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`annot inline-flex items-center gap-1 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
          align === "right" ? "w-full justify-end" : align === "center" ? "w-full justify-center" : ""
        }`}
      >
        {label}
        <span aria-hidden className={`text-[9px] ${active ? "text-mint" : "text-ink-faint"}`}>
          {active ? (sort.dir === "asc" ? "▲" : "▼") : "▵"}
        </span>
      </button>
    </th>
  );
}

function SquadListRow({
  row,
  selected,
  onPitch,
  maxLoad,
  dragging,
  canManage,
  editing,
  onEdit,
  onDone,
  onSelect,
  onToggleIn,
  beginPress,
  positionConfirmed,
}: {
  row: SquadRow;
  selected: boolean;
  onPitch: boolean;
  maxLoad: number;
  dragging: boolean;
  canManage: boolean;
  editing: boolean;
  onEdit: () => void;
  onDone: () => void;
  onSelect: () => void;
  onToggleIn?: () => void;
  beginPress: (e: React.PointerEvent, id: string, fromGrip: boolean) => void;
  positionConfirmed: boolean;
}) {
  const { player, availability, weekLoad, readiness, flag } = row;
  const status = statusOf(row);
  const loadTitle = readiness.ratio === null ? "needs 28 days of data" : `this week is ${readiness.ratio.toFixed(2)}x his usual week`;
  return (
    <>
      <tr
        data-player={player.id}
        data-on-pitch={onPitch ? "1" : undefined}
        aria-selected={selected}
        onPointerDown={(e) => beginPress(e, player.id, false)}
        className={`h-[38px] border-b border-line transition-colors sm:h-[38px] max-sm:h-[52px] duration-[190ms] ease-[var(--ease-out-strong)] ${
          selected ? "bg-panel-2" : "hover:bg-panel-2"
        } ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      >
        <td className={`${CELL} num text-right text-[12px] text-ink-dim`}>
          <button
            type="button"
            aria-label={`${selected ? "unselect" : "select"} ${player.name}`}
            aria-pressed={selected}
            onPointerDown={(e) => {
              e.stopPropagation();
              beginPress(e, player.id, true);
            }}
            onClick={onSelect}
            className={`pressable inline-flex h-7 w-7 touch-none items-center justify-center border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
              selected ? "border-mint text-mint" : onPitch ? "border-mint/40 text-ink" : "border-line text-ink-dim"
            }`}
          >
            {player.squad_number ?? "·"}
          </button>
        </td>
        <th scope="row" className={`${CELL} text-left font-normal`}>
          <span className="flex min-w-0 items-center gap-2">
            <Link
              href={`/player/${player.id}`}
              onPointerDown={(e) => e.stopPropagation()}
              className="pressable min-w-0 text-[13px] font-semibold leading-tight text-ink hover:text-mint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint max-sm:line-clamp-2 max-sm:min-h-0 sm:truncate"
            >
              {player.name}
            </Link>
            {onPitch ? (
              <span aria-label="in the eleven" className="num shrink-0 text-[9.5px] font-bold tracking-[0.1em] text-mint">
                XI
              </span>
            ) : null}
          </span>
        </th>
        <td className={`${CELL} num text-[11px] tracking-[0.08em] text-ink-dim`}>
          {positionConfirmed ? player.position : <SetPositionControl player={player} />}
        </td>
        <td className={CELL}>
          <StatusPill status={status} returnDate={availability?.return_date} />
        </td>
        <td className={`${CELL} hidden sm:table-cell`} title={loadTitle}>
          <span className={`num block text-[10.5px] font-semibold tracking-[0.08em] ${READINESS_TEXT[readiness.key]}`}>{readiness.word.toUpperCase()}</span>
          <ConditionBar value={weekLoad} max={maxLoad} flag={flag} />
        </td>
        <td className={`${CELL} num hidden text-right text-[12px] text-ink sm:table-cell`}>{played(row) || <span className="text-ink-faint">0</span>}</td>
        <td className={`${CELL} num hidden text-right text-[12px] sm:table-cell ${goals(row) > 0 ? "text-ink" : "text-ink-faint"}`}>{goals(row)}</td>
        <td className={`${CELL} text-right`}>
          <span className="inline-flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
            {onToggleIn ? (
              <button
                type="button"
                aria-pressed={onPitch}
                aria-label={onPitch ? `take ${player.name} out of the side` : `put ${player.name} in the side`}
                onClick={onToggleIn}
                className={`pressable inline-flex h-10 w-10 items-center justify-center rounded-[2px] border text-[12px] font-bold tracking-[0.06em] transition-colors duration-[190ms] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:hidden ${
                  onPitch ? "border-mint bg-mint text-mint-ink" : "border-line-strong bg-panel-2 text-ink-dim"
                }`}
              >
                {onPitch ? "in" : "+"}
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                aria-label={`edit ${player.name}`}
                aria-expanded={editing}
                onClick={onEdit}
                className="pressable num hidden h-6 px-1.5 text-[10px] tracking-[0.08em] text-ink-faint hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:inline-flex"
              >
                EDIT
              </button>
            ) : null}
            <StatusMenu playerId={player.id} playerName={player.name} current={status} />
          </span>
        </td>
      </tr>
      {editing ? (
        <tr className="border-b border-line">
          <td colSpan={8} className="p-0">
            <EditPlayerRow player={player} onDone={onDone} />
          </td>
        </tr>
      ) : null}
    </>
  );
}
