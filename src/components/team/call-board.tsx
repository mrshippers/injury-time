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
};

type Row = { status: CallStatus | null; note: string | null; updatedAt: string | null };

const FLASH_MS = 900;

export function CallBoard({ clubId, fixture, players, calls, role, ownPlayerId, usual = {} }: CallBoardProps) {
  const initial = useMemo(() => {
    const m = new Map<string, Row>();
    for (const c of calls) m.set(c.player_id, { status: c.status, note: c.note, updatedAt: c.updated_at });
    return m;
  }, [calls]);
  const [rows, setRows] = useState<Map<string, Row>>(initial);
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

const STOPS: { status: CallStatus; word: string; thumb: string }[] = [
  // the thumb takes the look of the app's status marks: solid is in, half-filled is unsure, struck through is out
  { status: "in", word: "in", thumb: "call-thumb-in" },
  { status: "unsure", word: "unsure", thumb: "call-thumb-unsure" },
  { status: "out", word: "out", thumb: "call-thumb-out" },
];

/**
 * The answer as a switch on a hairline: one line through three notched stops, the words
 * underneath, and a square-cut plate that slides along the line to the chosen stop. The thumb carries the word and a
 * shape (solid / half / struck), so the answer never rests on colour alone. Unanswered
 * shows a dashed thumb where he went last time; tapping anywhere still answers.
 * Still a radio group underneath, with arrow keys.
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
  const at = value ? STOPS.findIndex((s) => s.status === value) : -1;
  const ghost = !value && usual ? STOPS.findIndex((s) => s.status === usual) : -1;
  const width = large ? "sm:w-[240px]" : "sm:w-[196px]";
  const plate = large ? "h-[28px] text-[13px]" : "h-[24px] text-[11px]";
  return (
    <div
      role="radiogroup"
      aria-label={`${name}: call`}
      onKeyDown={onKey}
      className={`call-switch relative grid h-[54px] w-full grid-cols-3 ${width} ${large ? "sm:h-[58px]" : "sm:h-[50px]"} ${disabled ? "opacity-70" : ""}`}
    >
      {/* one hairline through the three stops, a notch at each: the fourth official's board, not three boxes */}
      <span aria-hidden className="pointer-events-none absolute left-[16.667%] right-[16.667%] top-[16px] h-px bg-line-strong" />
      {[16.667, 50, 83.333].map((l) => (
        <span key={l} aria-hidden className="pointer-events-none absolute top-[12px] h-[9px] w-px -translate-x-1/2 bg-line-strong" style={{ left: `${l}%` }} />
      ))}
      {/* last time, as a marker only */}
      {ghost >= 0 ? (
        <span aria-hidden className="pointer-events-none absolute left-0 top-[4px] w-1/3 px-[6px]" style={{ transform: `translateX(${ghost * 100}%)` }}>
          <span className={`call-thumb call-thumb-ghost flex items-center justify-center ${plate}`}>
            <span className="num font-semibold uppercase tracking-[0.1em] text-ink-dim">{STOPS[ghost].word}?</span>
          </span>
        </span>
      ) : null}
      {/* the plate: slides along the line to the answer, never jumps */}
      {at >= 0 ? (
        <span aria-hidden className="call-slide pointer-events-none absolute left-0 top-[4px] z-[1] w-1/3 px-[6px]" style={{ transform: `translateX(${at * 100}%)` }}>
          <span className={`call-thumb ${STOPS[at].thumb} flex items-center justify-center ${plate}`}>
            <span className="num font-bold uppercase tracking-[0.1em]">{STOPS[at].word}</span>
          </span>
        </span>
      ) : null}
      {STOPS.map((s, i) => {
        const on = value === s.status;
        return (
          <button
            key={s.status}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            tabIndex={on || (!value && s.status === "in") ? 0 : -1}
            onClick={() => onChoose(s.status)}
            className="pressable relative z-[2] flex flex-col items-center justify-end pb-[5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-mint disabled:cursor-default"
          >
            <span className={`num text-[10.5px] uppercase tracking-[0.12em] ${on ? "text-transparent" : ghost === i ? "text-ink-dim" : "text-ink-dim hover:text-ink"}`}>{s.word}</span>
          </button>
        );
      })}
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
