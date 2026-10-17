"use client";

/**
 * The call board: every player, one three-detent switch. A tap slides the
 * thumb to the answer, writes the call and the row lights for a beat; a change made in any other browser
 * arrives over the socket and lights the same way. A player sees their own
 * row first and large, everyone else read-only.
 *
 * On a phone the name sits on its own line (two lines if it needs them) and
 * the three answers run the full width beneath it, each a thumb's height;
 * the count line stays pinned under the nav while the list scrolls. A note
 * is behind a small "note" control so twenty-two placeholders never stack.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { setCallAction, setCallDeadlineAction, setCallsBulkAction } from "@/lib/team/actions";
import { closeLabel, isClosed, presets, timeLeft } from "@/lib/team/deadline";
import { useStoredValue } from "@/components/three/tokens";
import { Nudge } from "@/components/no2/nudge";
import { countCalls, countLine } from "@/lib/team/format";
import { useTeamRealtime } from "@/lib/team/realtime";
import { CALL_STATUSES, type CallStatus, type ClubRole, type Fixture, type MatchCall, type Player } from "@/lib/types";

export type CallBoardProps = {
  clubId: string;
  fixture: Fixture;
  players: Player[];
  calls: MatchCall[];
  role: ClubRole;
  /** the signed-in player's own row, when the viewer is a player */
  ownPlayerId: string | null;
  /** each player's answer last time: shown as a dashed marker, never saved until someone taps */
  usual?: Record<string, CallStatus>;
  /** a club nobody here can write to: taps move the switch on screen and save nothing */
  readOnly?: boolean;
};

type Row = { status: CallStatus | null; note: string | null; updatedAt: string | null };

const FLASH_MS = 900;

export function CallBoard({ clubId, fixture, players, calls, role, ownPlayerId, usual = {}, readOnly = false }: CallBoardProps) {
  const initial = useMemo(() => {
    const m = new Map<string, Row>();
    for (const c of calls) m.set(c.player_id, { status: c.status, note: c.note, updatedAt: c.updated_at });
    return m;
  }, [calls]);
  const [rowsState, setRows] = useState<Map<string, Row>>(initial);
  // a read-only club keeps your answers in this browser, per match, so they're still there next time
  const localKey = `injury-time.calls.${fixture.id}`;
  const stored = useStoredValue(localKey);
  const rows = useMemo(() => {
    if (!readOnly || !stored) return rowsState;
    try {
      const saved = JSON.parse(stored) as Record<string, CallStatus>;
      const n = new Map(rowsState);
      for (const [id, status] of Object.entries(saved)) n.set(id, { status, note: n.get(id)?.note ?? null, updatedAt: n.get(id)?.updatedAt ?? null });
      return n;
    } catch {
      return rowsState;
    }
  }, [readOnly, stored, rowsState]);
  const keepLocal = useCallback(
    (patch: Record<string, CallStatus>) => {
      try {
        const saved = JSON.parse(localStorage.getItem(localKey) ?? "{}") as Record<string, CallStatus>;
        localStorage.setItem(localKey, JSON.stringify({ ...saved, ...patch }));
      } catch {}
    },
    [localKey],
  );
  const [flash, setFlash] = useState<Map<string, number>>(new Map());
  const [noteOpen, setNoteOpen] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const light = useCallback((playerId: string) => {
    setFlash((f) => new Map(f).set(playerId, Date.now()));
    const prev = timers.current.get(playerId);
    if (prev) clearTimeout(prev);
    timers.current.set(
      playerId,
      setTimeout(() => {
        setFlash((f) => {
          const n = new Map(f);
          n.delete(playerId);
          return n;
        });
      }, FLASH_MS),
    );
  }, []);

  useEffect(() => {
    const t = timers.current;
    return () => {
      for (const id of t.values()) clearTimeout(id);
    };
  }, []);

  useTeamRealtime(clubId, fixture.id, {
    onCall: (call, event) => {
      setRows((r) => {
        const n = new Map(r);
        if (event === "DELETE") n.delete(call.player_id);
        else n.set(call.player_id, { status: call.status, note: call.note, updatedAt: call.updated_at });
        return n;
      });
      light(call.player_id);
    },
  });

  const staff = role !== "player";
  // the deadline: a minute clock is enough for "in 40 min"; after it only staff can change an answer
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const [closesAt, setClosesAt] = useState<string | null>(fixture.calls_close_at ?? null);
  const closed = isClosed(closesAt, now);
  const setDeadline = async (iso: string | null) => {
    const before = closesAt;
    setClosesAt(iso);
    setError(null);
    if (readOnly) return;
    const res = await setCallDeadlineAction({ fixtureId: fixture.id, closesAt: iso });
    if (!res.ok) {
      setClosesAt(before);
      setError(res.error);
    }
  };
  const canSet = (playerId: string) => staff || (playerId === ownPlayerId && !closed);

  const choose = async (playerId: string, status: CallStatus) => {
    const before = rows.get(playerId) ?? { status: null, note: null, updatedAt: null };
    setRows((r) => new Map(r).set(playerId, { ...before, status, updatedAt: new Date().toISOString() }));
    light(playerId);
    setError(null);
    if (readOnly) {
      keepLocal({ [playerId]: status });
      return;
    }
    const res = await setCallAction({ fixtureId: fixture.id, playerId, status, note: before.note ?? undefined });
    if (!res.ok) {
      setRows((r) => new Map(r).set(playerId, before));
      setError(res.error);
    }
  };

  const saveNote = async (playerId: string, note: string) => {
    const cur = rows.get(playerId);
    if (!cur?.status) return;
    const trimmed = note.trim();
    setNoteOpen((s) => {
      const n = new Set(s);
      n.delete(playerId);
      return n;
    });
    if ((cur.note ?? "") === trimmed) return;
    setRows((r) => new Map(r).set(playerId, { ...cur, note: trimmed || null }));
    if (readOnly) return;
    const res = await setCallAction({ fixtureId: fixture.id, playerId, status: cur.status, note: trimmed });
    if (!res.ok) setError(res.error);
  };

  const openNote = (playerId: string) =>
    setNoteOpen((s) => {
      const n = new Set(s);
      n.add(playerId);
      return n;
    });

  const counts = countCalls(
    players.map((p) => p.id),
    [...rows.entries()].filter(([, r]) => r.status).map(([player_id, r]) => ({ player_id, status: r.status! })),
  );

  // staff: one tap answers for everyone who has not, with what each of them said last time
  const toFill = staff
    ? players.filter((p) => !rows.get(p.id)?.status && usual[p.id]).map((p) => ({ playerId: p.id, status: usual[p.id] }))
    : [];
  const [filling, setFilling] = useState(false);
  const fillTheRest = async () => {
    if (toFill.length === 0 || filling) return;
    const before = rows;
    setFilling(true);
    setError(null);
    setRows((r) => {
      const n = new Map(r);
      for (const c of toFill) n.set(c.playerId, { status: c.status, note: null, updatedAt: new Date().toISOString() });
      return n;
    });
    for (const c of toFill) light(c.playerId);
    if (readOnly) {
      keepLocal(Object.fromEntries(toFill.map((c) => [c.playerId, c.status])));
      setFilling(false);
      return;
    }
    const res = await setCallsBulkAction({ fixtureId: fixture.id, calls: toFill });
    if (!res.ok) {
      setRows(before);
      setError(res.error);
    }
    setFilling(false);
  };

  const ordered = useMemo(() => {
    if (!ownPlayerId) return players;
    const me = players.find((p) => p.id === ownPlayerId);
    return me ? [me, ...players.filter((p) => p.id !== ownPlayerId)] : players;
  }, [players, ownPlayerId]);

  return (
    <section aria-labelledby="calls-heading" className="bg-panel/60">
      <div className="z-10 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line bg-panel px-4 py-3 max-sm:sticky max-sm:top-12 sm:px-5">
        <p className="annot" id="calls-heading">{"// who's in"}</p>
        <p className="num text-[13px] text-ink sm:text-[12.5px]" data-testid="count-line" aria-live="polite">
          {countLine(counts)}
        </p>
        {toFill.length > 0 ? (
          <button
            type="button"
            onClick={fillTheRest}
            disabled={filling}
            data-testid="fill-the-rest"
            className="pressable num basis-full border-t border-line pt-2 text-left text-[12.5px] font-semibold text-mint hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:opacity-60 max-sm:min-h-11 max-sm:pt-3 sm:basis-auto sm:border-t-0 sm:pt-0"
          >
            {filling ? "filling" : `fill the other ${toFill.length} as last time`}
          </button>
        ) : null}
      </div>
      <DeadlineLine
        closesAt={closesAt}
        closed={closed}
        now={now}
        silent={players.filter((p) => !rows.get(p.id)?.status).map((p) => p.name)}
        options={staff ? presets(fixture.match_date, now) : []}
        onSet={staff ? setDeadline : undefined}
      />
      {staff ? <Nudge fixtureId={fixture.id} names={players.filter((p) => !rows.get(p.id)?.status).map((p) => p.name)} /> : null}
      {error ? (
        <p role="alert" className="border-b border-line px-4 py-2 text-[12.5px] text-out sm:px-5">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-line">
        {ordered.map((p) => {
          const row = rows.get(p.id) ?? { status: null, note: null, updatedAt: null };
          const mine = p.id === ownPlayerId;
          const editable = canSet(p.id);
          const lit = flash.has(p.id);
          const noteEditing = noteOpen.has(p.id);
          return (
            <li
              key={p.id}
              data-testid="call-row"
              data-player={p.id}
              data-status={row.status ?? "none"}
              className={`call-row grid min-h-14 grid-cols-1 items-center gap-x-3 gap-y-2 border-l-[3px] border-transparent px-[13px] transition-colors duration-[600ms] ease-[var(--ease-out-strong)] motion-reduce:transition-none sm:grid-cols-[minmax(0,1fr)_auto] sm:px-[17px] ${
                mine ? "bg-panel-2 py-5" : "py-3 sm:py-2.5"
              } ${lit ? "bg-panel-2" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <p className={`line-clamp-2 min-w-0 ${mine ? "display text-[26px]" : "text-[14px] font-semibold sm:text-[13.5px]"} text-ink`}>
                    {p.squad_number !== null ? <span className="num mr-2 text-[12px] font-normal text-ink-dim">{p.squad_number}</span> : null}
                    {p.name}
                    {knownPosition(p) ? <span className="num ml-2 text-[10.5px] font-normal tracking-[0.1em] text-ink-faint">{p.position}</span> : null}
                    {mine ? <span className="ml-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-mint">you</span> : null}
                  </p>
                  {row.status && editable && !noteEditing ? (
                    <button
                      type="button"
                      onClick={() => openNote(p.id)}
                      aria-label={row.note ? `${p.name}: change note` : `${p.name}: add a note`}
                      className="pressable -my-2 flex min-h-11 min-w-11 max-w-[55%] shrink-0 items-center justify-end text-right text-[12.5px] text-ink-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:-my-1 sm:min-h-0 sm:min-w-0 sm:max-w-[240px] sm:text-[12px]"
                    >
                      <span className={row.note ? "truncate text-ink-dim" : "text-ink-faint"}>{row.note ?? "note"}</span>
                    </button>
                  ) : row.note && !noteEditing ? (
                    <p className="max-w-[55%] truncate text-[12px] text-ink-dim">{row.note}</p>
                  ) : null}
                </div>
                {noteEditing ? (
                  <input
                    type="text"
                    autoFocus
                    defaultValue={row.note ?? ""}
                    maxLength={140}
                    placeholder="note for the gaffer"
                    aria-label={`${p.name}: note`}
                    onBlur={(e) => saveNote(p.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
                    }}
                    className="mt-2 h-11 w-full border-0 border-b border-line-strong bg-transparent px-3 text-[14px] text-ink placeholder:text-ink-faint focus:border-mint focus:outline-none sm:mt-1 sm:h-9 sm:max-w-[360px] sm:text-[13px]"
                  />
                ) : null}
              </div>
              <CallSwitch name={p.name} value={row.status} usual={usual[p.id] ?? null} large={mine} disabled={!editable} onChoose={(s) => choose(p.id, s)} />
            </li>
          );
        })}
      </ul>
      {players.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-dim">No players on the books yet.</p> : null}
    </section>
  );
}

/** a position is only shown when someone has said it: an unconfirmed MF placeholder is not a position */
function knownPosition(p: Player): boolean {
  const ext = p.external_stats as { position_confirmed?: boolean } | null;
  return ext?.position_confirmed !== false;
}

const STOPS: { status: CallStatus; word: string }[] = [
  { status: "in", word: "in" },
  { status: "unsure", word: "unsure" },
  { status: "out", word: "out" },
];

/** The three answers as icons in a circle: a tick for in, a question mark for unsure, a cross for out. Shape first, colour second. */
export function CallIcon({ status, size = 28, faint = false }: { status: CallStatus | null; size?: number; faint?: boolean }) {
  const r = size / 2;
  if (!status)
    return (
      <svg aria-hidden width={size} height={size} viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--line-strong)" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  const fill = status === "in" ? "var(--win)" : status === "out" ? "var(--out)" : "var(--ink-dim)";
  const mark = status === "in" ? "#06120d" : status === "out" ? "#fff" : "#0b0e0c";
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 28 28" style={{ opacity: faint ? 0.32 : 1 }} data-r={r}>
      {faint ? <circle cx="14" cy="14" r="12.5" fill="none" stroke={fill} strokeWidth="1.5" /> : <circle cx="14" cy="14" r="13" fill={fill} />}
      {status === "in" ? <path d="M8.2 14.4l3.8 3.8 7.8-8.2" fill="none" stroke={faint ? fill : mark} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /> : null}
      {status === "out" ? <path d="M9.4 9.4l9.2 9.2M18.6 9.4l-9.2 9.2" fill="none" stroke={faint ? fill : mark} strokeWidth="2.6" strokeLinecap="round" /> : null}
      {status === "unsure" ? (
        <text x="14" y="19.4" textAnchor="middle" fontSize="16" fontWeight="800" fill={faint ? fill : mark} style={{ fontFamily: "var(--font-display, inherit)" }}>
          ?
        </text>
      ) : null}
    </svg>
  );
}

/**
 * The answer as a thumb you drag along a track: a tick in a green circle for in, a question mark in grey for
 * unsure, a cross in red for out. Drag it, let go, it springs to the nearest answer. A tap on a stop still
 * answers, and underneath it is a radio group with arrow keys. Unanswered is an empty dashed ring in the
 * middle with last time's answer shown faint at its stop.
 */
export function CallSwitch({
  name,
  value,
  usual,
  large,
  disabled,
  onChoose,
}: {
  name: string;
  value: CallStatus | null;
  usual: CallStatus | null;
  large: boolean;
  disabled: boolean;
  onChoose: (s: CallStatus) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const press = useRef<{ x0: number; moved: boolean; id: number } | null>(null);
  const suppressClick = useRef(false);
  // while dragging: where the thumb is and which answer it is over, both worked out in the handler
  const [drag, setDrag] = useState<{ x: number; i: number } | null>(null);
  const dragX = drag?.x ?? null;
  const size = large ? 36 : 30;

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const i = value ? CALL_STATUSES.indexOf(value) : -1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % CALL_STATUSES.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + CALL_STATUSES.length) % CALL_STATUSES.length;
    if (next === null) return;
    e.preventDefault();
    onChoose(STOPS[next].status);
    (e.currentTarget.querySelectorAll<HTMLElement>("[role=radio]")[next])?.focus();
  };

  // the stops sit at the centre of each third of the track
  const local = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.min(r.width, Math.max(0, clientX - r.left));
  };
  const nearest = (x: number) => {
    const w = box.current!.getBoundingClientRect().width;
    return Math.min(2, Math.max(0, Math.floor((x / w) * 3)));
  };

  const at = value ? STOPS.findIndex((s) => s.status === value) : -1;
  const ghost = !value && usual ? STOPS.findIndex((s) => s.status === usual) : -1;
  const restPct = at >= 0 ? ((at + 0.5) / 3) * 100 : 50;
  const shown: CallStatus | null = drag ? STOPS[drag.i].status : value;

  return (
    <div
      ref={box}
      role="radiogroup"
      aria-label={`${name}: call`}
      onKeyDown={onKey}
      onPointerDown={(e) => {
        if (disabled || e.button !== 0) return;
        press.current = { x0: e.clientX, moved: false, id: e.pointerId };
      }}
      onPointerMove={(e) => {
        const p = press.current;
        if (!p || p.id !== e.pointerId) return;
        if (!p.moved && Math.abs(e.clientX - p.x0) < 5) return;
        if (!p.moved) {
          p.moved = true;
          box.current?.setPointerCapture(e.pointerId);
        }
        const x = local(e.clientX);
        setDrag({ x, i: nearest(x) });
      }}
      onPointerUp={(e) => {
        const p = press.current;
        press.current = null;
        if (!p || !p.moved) return;
        const i = nearest(local(e.clientX));
        setDrag(null);
        suppressClick.current = true;
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);
        if (STOPS[i].status !== value) onChoose(STOPS[i].status);
      }}
      onPointerCancel={() => {
        press.current = null;
        setDrag(null);
      }}
      className={`call-switch relative h-[52px] w-full touch-pan-y select-none ${large ? "sm:w-[250px]" : "sm:w-[204px]"} ${disabled ? "opacity-70" : "cursor-grab active:cursor-grabbing"}`}
    >
      {/* the track: one hairline, a faint icon at each stop showing where you can land */}
      <span aria-hidden className="pointer-events-none absolute left-[16.667%] right-[16.667%] top-1/2 h-px -translate-y-1/2 bg-line-strong" />
      {STOPS.map((s, i) => (
        <span key={s.status} aria-hidden className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${((i + 0.5) / 3) * 100}%` }}>
          <CallIcon status={s.status} size={large ? 22 : 18} faint />
          {ghost === i ? <span className="absolute -inset-1 rounded-full border border-dashed border-ink-dim" /> : null}
        </span>
      ))}
      {/* the thumb: follows the finger while dragging, springs to the answer on release */}
      <span
        aria-hidden
        className={`call-knob pointer-events-none absolute top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 ${dragX === null ? "is-resting" : "scale-110"}`}
        style={{ left: dragX !== null ? `${dragX}px` : `${restPct}%` }}
      >
        <CallIcon status={shown} size={size} />
      </span>
      {/* the radios: invisible over each stop, so a tap and a screen reader both still answer */}
      <div className="absolute inset-0 z-[2] grid grid-cols-3">
        {STOPS.map((s) => {
          const on = value === s.status;
          return (
            <button
              key={s.status}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={s.word}
              disabled={disabled}
              tabIndex={on || (!value && s.status === "in") ? 0 : -1}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                onChoose(s.status);
              }}
              className="h-full w-full opacity-0 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint disabled:cursor-default"
            />
          );
        })}
      </div>
    </div>
  );
}

/**
 * The deadline under the count. Open: when answers close and how long is left. Closed: who never answered,
 * by name, so the gaffer chases a list, not a feeling. Staff get one-tap presets and a clear.
 */
function DeadlineLine({
  closesAt,
  closed,
  now,
  silent,
  options,
  onSet,
}: {
  closesAt: string | null;
  closed: boolean;
  now: number;
  silent: string[];
  options: { label: string; iso: string }[];
  onSet?: (iso: string | null) => void;
}) {
  if (!closesAt && !onSet) return null;
  const btn = "pressable plate plate-sm num bg-panel-2 py-1 text-[11.5px] text-ink transition-transform duration-200 hover:translate-x-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint max-sm:min-h-10";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-2.5 sm:px-5" data-testid="deadline">
      {closesAt ? (
        <p className="num text-[12px] text-ink" suppressHydrationWarning>
          <span aria-hidden className={`mr-2 inline-block size-2 align-[1px] ${closed ? "bg-ink" : "border border-ink"}`} />
          {closed ? `answers closed ${closeLabel(closesAt)}` : `answers close ${closeLabel(closesAt)} · ${timeLeft(closesAt, now)}`}
          {closed && silent.length > 0 ? <span className="text-ink-dim">{` · ${silent.length} didn't answer: ${silent.join(", ")}`}</span> : null}
        </p>
      ) : (
        <p className="num text-[12px] text-ink-dim">no deadline set</p>
      )}
      {onSet ? (
        <span className="flex flex-wrap items-center gap-1.5">
          {options
            .filter((o) => !closesAt || Date.parse(o.iso) !== Date.parse(closesAt))
            .map((o) => (
              <button key={o.iso} type="button" className={btn} onClick={() => onSet(o.iso)}>
                {closesAt ? `move to ${o.label}` : `close ${o.label}`}
              </button>
            ))}
          {closesAt ? (
            <button type="button" className={`${btn} text-ink-dim`} onClick={() => onSet(null)}>
              clear
            </button>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}
