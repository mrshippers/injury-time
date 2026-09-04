"use client";

import { useState, useTransition } from "react";
import { logSessionAction } from "@/app/log/actions";
import type { Club, SessionKind } from "@/lib/types";
import {
  defaultMinutesFor,
  effective,
  initialRowState,
  isIncluded,
  type RosterPlayer,
  type RowState,
  type SessionDefault,
} from "./session-state";
import { SessionHeader } from "./SessionHeader";
import { PlayerRow } from "./PlayerRow";
import { StickyBar } from "./StickyBar";

export function SessionForm({
  club,
  players,
  today,
}: {
  club: Club;
  players: RosterPlayer[];
  today: string;
}) {
  const [kind, setKind] = useState<SessionKind>("training");
  const [sessionDate, setSessionDate] = useState(today);
  const [opponent, setOpponent] = useState("");
  const [def, setDef] = useState<SessionDefault>({ rpe: null, minutes: defaultMinutesFor("training") });
  const [rows, setRows] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(players.map((p) => [p.id, initialRowState()])),
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function updateRow(playerId: string, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [playerId]: { ...prev[playerId], ...patch } }));
  }

  function handleKindChange(next: SessionKind) {
    setKind(next);
    // the session default follows the kind; per-row overrides are kept
    setDef((d) => ({ ...d, minutes: defaultMinutesFor(next) }));
  }

  const included = players.filter((p) => isIncluded(p.status, rows[p.id]));
  const logged = included.filter((p) => effective(rows[p.id], def).rpe !== null);
  const inheriting = included.filter((p) => rows[p.id].rpe === null && rows[p.id].minutes === null).length;

  function handleSave() {
    if (logged.length < 1 || isPending) return;
    const entries = logged.map((p) => {
      const row = rows[p.id];
      const eff = effective(row, def);
      return {
        playerId: p.id,
        rpe: eff.rpe as number,
        minutes: eff.minutes,
        goals: row.goals,
        assists: row.assists,
        yellow: row.yellow,
        red: row.red,
      };
    });
    setError(null);
    startTransition(async () => {
      try {
        await logSessionAction({
          sessionDate,
          kind,
          opponent: kind === "match" && opponent.trim() ? opponent.trim() : undefined,
          entries,
        });
      } catch {
        setError("could not save that session - try again");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col pb-36 sm:pb-28">
      <SessionHeader
        kind={kind}
        onKindChange={handleKindChange}
        sessionDate={sessionDate}
        onDateChange={setSessionDate}
        opponent={opponent}
        onOpponentChange={setOpponent}
        def={def}
        onDefaultChange={(patch) => setDef((d) => ({ ...d, ...patch }))}
        inheriting={inheriting}
        total={included.length}
      />
      <h2 className="sr-only">{club.name} roster</h2>
      <div className="mx-auto w-full max-w-[1240px]">
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            row={rows[p.id]}
            def={def}
            kind={kind}
            onChange={(patch) => updateRow(p.id, patch)}
          />
        ))}
      </div>
      {error && <p className="px-3 pt-3 text-sm text-out">{error}</p>}
      <StickyBar
        loggedCount={logged.length}
        totalCount={included.length}
        kind={kind}
        sessionDate={sessionDate}
        isPending={isPending}
        onSave={handleSave}
      />
    </div>
  );
}
