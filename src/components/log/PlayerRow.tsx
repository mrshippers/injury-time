"use client";

import { isOut, type RosterPlayer, type RowState } from "./session-state";
import { RpeChips } from "./ChipGroup";
import { MinutesChips } from "./MinutesChips";

export function PlayerRow({
  player,
  row,
  onRpeChange,
  onMinutesPreset,
  onMinutesStep,
  onToggleStepper,
  onToggleAbsent,
  onToggleExpanded,
}: {
  player: RosterPlayer;
  row: RowState;
  onRpeChange: (rpe: number) => void;
  onMinutesPreset: (minutes: number) => void;
  onMinutesStep: (delta: number) => void;
  onToggleStepper: () => void;
  onToggleAbsent: () => void;
  onToggleExpanded: () => void;
}) {
  const out = isOut(player.status);
  const collapsed = out && !row.expanded;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={onToggleExpanded}
        aria-label={`${player.name}, ${player.status}, tap to include in session`}
        className="pressable flex w-full items-center gap-3 border-b border-line px-3 py-3 text-left hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
      >
        <span className="num w-5 shrink-0 text-right text-ink-dim">
          {player.squad_number ?? "–"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">
          {player.name}
        </span>
        <span
          className={`annot shrink-0 ${player.status === "injured" ? "text-out" : "text-susp"}`}
        >
          {player.status === "injured" ? "out" : "susp"}
        </span>
        <span aria-hidden className="num shrink-0 text-xs text-ink-dim">
          +
        </span>
      </button>
    );
  }

  return (
    <div
      data-testid="player-row"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-3 py-3"
    >
      <div className="flex min-w-[130px] flex-1 basis-[130px] items-center gap-2 sm:w-44 sm:flex-none">
        <span className="num w-5 shrink-0 text-right text-ink-dim">
          {player.squad_number ?? "–"}
        </span>
        <span
          className={`min-w-0 truncate text-[13px] sm:text-sm ${row.absent ? "text-ink-dim" : "text-ink"}`}
        >
          {player.name}
        </span>
        {player.status === "doubt" && (
          <span className="annot shrink-0 text-doubt">doubt</span>
        )}
        {out && (
          <span
            className={`annot shrink-0 ${player.status === "injured" ? "text-out" : "text-susp"}`}
          >
            {player.status === "injured" ? "out" : "susp"}
          </span>
        )}
      </div>

      {!row.absent && (
        <div className="flex flex-wrap items-center gap-2">
          <RpeChips
            value={row.rpe}
            onChange={onRpeChange}
            ariaLabel={`${player.name} rpe`}
          />
          <MinutesChips
            minutes={row.minutes}
            stepperOpen={row.stepperOpen}
            onSelectPreset={onMinutesPreset}
            onToggleStepper={onToggleStepper}
            onStep={onMinutesStep}
            ariaLabel={`${player.name} minutes`}
          />
        </div>
      )}

      <div className="ml-auto flex items-center gap-1.5">
        {out && (
          <button
            type="button"
            onClick={onToggleExpanded}
            aria-label={`collapse ${player.name}`}
            className="pressable num flex h-6 w-6 items-center justify-center text-xs text-ink-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
          >
            –
          </button>
        )}
        <button
          type="button"
          onClick={onToggleAbsent}
          aria-pressed={row.absent}
          className={`pressable annot h-7 rounded-[3px] border px-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
            row.absent
              ? "border-line-strong bg-panel-2 text-ink"
              : "border-line text-ink-dim hover:border-line-strong hover:text-ink"
          }`}
        >
          {row.absent ? "in" : "absent"}
        </button>
      </div>
    </div>
  );
}
