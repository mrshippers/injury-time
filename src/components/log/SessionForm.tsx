"use client";

import { useState, useTransition } from "react";
import { logSessionAction } from "@/app/log/actions";
import type { Club, SessionKind } from "@/lib/types";
import {
  defaultMinutesFor,
  initialRowState,
  isIncluded,
  type RosterPlayer,
  type RowState,
} from "./session-state";
import { SessionHeader } from "./SessionHeader";
import { PlayerRow } from "./PlayerRow";
import { StickyBar } from "./StickyBar";

const MIN_MINUTES = 15;
const MAX_MINUTES = 150;

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
    setRows((prev) => {
      const updated = { ...prev };
      for (const id of Object.keys(updated)) {
        if (!updated[id].minutesTouched) {
          updated[id] = { ...updated[id], minutes: defaultMinutesFor(next) };
        }
      }
      return updated;
    });
  }

  function handleMinutesPreset(playerId: string, minutes: number) {
    updateRow(playerId, { minutes, minutesTouched: true, stepperOpen: false });
  }

  function handleMinutesStep(playerId: string, delta: number) {
    setRows((prev) => {
      const row = prev[playerId];
      const minutes = Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, row.minutes + delta));
      return { ...prev, [playerId]: { ...row, minutes, minutesTouched: true } };
    });
  }

  function handleToggleAbsent(playerId: string) {
    setRows((prev) => {
      const row = prev[playerId];
      const nextAbsent = !row.absent;
      return {
        ...prev,
        [playerId]: { ...row, absent: nextAbsent, rpe: nextAbsent ? null : row.rpe },
      };
    });
  }

  const includedPlayers = players.filter((p) => isIncluded(p.status, rows[p.id]));
  const loggedPlayers = includedPlayers.filter((p) => rows[p.id].rpe !== null);

  function handleSave() {
    if (loggedPlayers.length < 1 || isPending) return;
    const entries = loggedPlayers.map((p) => ({
      playerId: p.id,
      rpe: rows[p.id].rpe as number,
      minutes: rows[p.id].minutes,
    }));
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
    <div className="flex flex-1 flex-col pb-28">
      <SessionHeader
        kind={kind}
        onKindChange={handleKindChange}
        sessionDate={sessionDate}
        onDateChange={setSessionDate}
        opponent={opponent}
        onOpponentChange={setOpponent}
      />
      <h2 className="sr-only">{club.name} roster</h2>
      <div>
        {players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            row={rows[p.id]}
            onRpeChange={(rpe) => updateRow(p.id, { rpe })}
            onMinutesPreset={(m) => handleMinutesPreset(p.id, m)}
            onMinutesStep={(d) => handleMinutesStep(p.id, d)}
            onToggleStepper={() => updateRow(p.id, { stepperOpen: !rows[p.id].stepperOpen })}
            onToggleAbsent={() => handleToggleAbsent(p.id)}
            onToggleExpanded={() => updateRow(p.id, { expanded: !rows[p.id].expanded })}
          />
        ))}
      </div>
      {error && <p className="px-3 pt-3 text-sm text-out">{error}</p>}
      <StickyBar
        loggedCount={loggedPlayers.length}
        totalCount={includedPlayers.length}
        kind={kind}
        sessionDate={sessionDate}
        isPending={isPending}
        onSave={handleSave}
      />
    </div>
  );
}
