"use client";

/**
 * The call board: every player, three square-cut answers. A tap writes the
 * call and the row lights for a beat; a change made in any other browser
 * arrives over the socket and lights the same way. A player sees their own
 * row first and large, everyone else read-only.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { setCallAction } from "@/lib/team/actions";
import { CALL_META, countCalls, countLine } from "@/lib/team/format";
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
};

type Row = { status: CallStatus | null; note: string | null; updatedAt: string | null };

const FLASH_MS = 900;

export function CallBoard({ clubId, fixture, players, calls, role, ownPlayerId }: CallBoardProps) {
  const initial = useMemo(() => {
    const m = new Map<string, Row>();
    for (const c of calls) m.set(c.player_id, { status: c.status, note: c.note, updatedAt: c.updated_at });
    return m;
  }, [calls]);
  const [rows, setRows] = useState<Map<string, Row>>(initial);
  const [flash, setFlash] = useState<Map<string, number>>(new Map());
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
  const canSet = (playerId: string) => staff || playerId === ownPlayerId;

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
    if ((cur.note ?? "") === trimmed) return;
    setRows((r) => new Map(r).set(playerId, { ...cur, note: trimmed || null }));
    const res = await setCallAction({ fixtureId: fixture.id, playerId, status: cur.status, note: trimmed });
    if (!res.ok) setError(res.error);
  };

  const counts = countCalls(
    players.map((p) => p.id),
    [...rows.entries()].filter(([, r]) => r.status).map(([player_id, r]) => ({ player_id, status: r.status! })),
  );

  const ordered = useMemo(() => {
    if (!ownPlayerId) return players;
    const me = players.find((p) => p.id === ownPlayerId);
    return me ? [me, ...players.filter((p) => p.id !== ownPlayerId)] : players;
  }, [players, ownPlayerId]);

  return (
    <section aria-labelledby="calls-heading" className="border border-line bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3 sm:px-5">
        <p className="annot" id="calls-heading">{"// who's in"}</p>
        <p className="num text-[12.5px] text-ink" data-testid="count-line" aria-live="polite">
          {countLine(counts)}
        </p>
      </div>
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
          return (
            <li
              key={p.id}
              data-testid="call-row"
              data-player={p.id}
              data-status={row.status ?? "none"}
              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 transition-colors duration-[600ms] ease-[var(--ease-out-strong)] motion-reduce:transition-none sm:px-5 ${
                mine ? "py-5 bg-panel-2" : "py-2.5"
              } ${lit ? "bg-panel-2" : ""}`}
            >
              <div className="min-w-0">
                <p className={`truncate ${mine ? "display text-[26px]" : "text-[13.5px] font-semibold"} text-ink`}>
                  {p.squad_number !== null ? <span className="num mr-2 text-ink-dim font-normal text-[12px]">{p.squad_number}</span> : null}
                  {p.name}
                  {mine ? <span className="ml-2 text-[11px] font-semibold tracking-[0.12em] text-mint uppercase">you</span> : null}
                </p>
                {row.status && editable ? (
                  <input
                    type="text"
                    defaultValue={row.note ?? ""}
                    maxLength={140}
                    placeholder="note for the gaffer"
                    aria-label={`${p.name}: note`}
                    onBlur={(e) => saveNote(p.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="mt-1 w-full max-w-[360px] border-0 border-b border-line bg-transparent px-0 py-0.5 text-[12px] text-ink-dim placeholder:text-ink-faint focus:border-mint focus:outline-none"
                  />
                ) : row.note ? (
                  <p className="mt-0.5 truncate text-[12px] text-ink-dim">{row.note}</p>
                ) : null}
              </div>
              <CallChoice
                name={p.name}
                value={row.status}
                large={mine}
                disabled={!editable}
                onChoose={(s) => choose(p.id, s)}
              />
            </li>
          );
        })}
      </ul>
      {players.length === 0 ? <p className="px-5 py-8 text-center text-sm text-ink-dim">No players on the books yet.</p> : null}
    </section>
  );
}

/** Three square-cut answers as a radio group. The word carries the meaning; colour only echoes it. */
function CallChoice({
  name,
  value,
  large,
  disabled,
  onChoose,
}: {
  name: string;
  value: CallStatus | null;
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
    onChoose(CALL_STATUSES[next]);
    const el = (e.currentTarget.children[next] as HTMLElement | undefined);
    el?.focus();
  };
  return (
    <div role="radiogroup" aria-label={`${name}: call`} onKeyDown={onKey} className={`flex ${large ? "gap-1.5" : "gap-1"}`}>
      {CALL_STATUSES.map((s) => {
        const meta = CALL_META[s];
        const on = value === s;
        return (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            tabIndex={on || (!value && s === "in") ? 0 : -1}
            onClick={() => onChoose(s)}
            className={`pressable rounded-[2px] border font-semibold tracking-[0.1em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint disabled:cursor-default ${
              large ? "h-11 px-5 text-[13px]" : "h-8 px-2.5 text-[10.5px]"
            } ${
              on ? `${meta.fill} border-transparent text-mint-ink` : `bg-pitch ${disabled ? "border-line text-ink-faint" : `${meta.border} ${meta.text} hover:bg-panel-2`}`
            }`}
          >
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}
