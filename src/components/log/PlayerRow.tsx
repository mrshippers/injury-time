"use client";

import type { SessionKind } from "@/lib/types";
import { RpeChips } from "./ChipGroup";
import { MinutesChips } from "./MinutesChips";
import {
  MAX_GOALS,
  effective,
  isOut,
  type RosterPlayer,
  type RowState,
  type SessionDefault,
} from "./session-state";

/** Tiny tap-to-increment counter for goals / assists / cards on a match row. */
function Counter({
  label,
  value,
  max,
  onChange,
  tone,
  ariaLabel,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  tone?: string;
  ariaLabel: string;
}) {
  const live = value > 0;
  return (
    <button
      type="button"
      aria-label={`${ariaLabel}: ${value}, tap to add`}
      onClick={() => onChange(value >= max ? 0 : value + 1)}
      className={`pressable num flex h-7 min-w-[38px] items-center justify-center gap-1 rounded-[3px] border px-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
        live ? `border-line-strong bg-panel-2 ${tone ?? "text-ink"}` : "border-line text-ink-dim hover:border-line-strong hover:text-ink"
      }`}
    >
      <span className="tracking-[0.08em]">{label}</span>
      <span className={live ? "font-semibold" : ""}>{value}</span>
    </button>
  );
}

/**
 * One line per player. Closed, it shows what will be saved (inherited values
 * dimmed, overrides bright). Tap the name to open the editor under it.
 */
export function PlayerRow({
  player,
  row,
  def,
  kind,
  onChange,
}: {
  player: RosterPlayer;
  row: RowState;
  def: SessionDefault;
  kind: SessionKind;
  onChange: (patch: Partial<RowState>) => void;
}) {
  const out = isOut(player.status);
  const collapsed = out && !row.expanded;
  const eff = effective(row, def);
  const inheritsRpe = row.rpe === null;
  const inheritsMin = row.minutes === null;
  const isMatch = kind === "match";

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => onChange({ expanded: true })}
        aria-label={`${player.name}, ${player.status}, tap to include in session`}
        className="pressable flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:px-6"
      >
        <span className="num w-5 shrink-0 text-right text-[12px] text-ink-dim">{player.squad_number ?? "–"}</span>
        <span className="min-w-0 flex-1 truncate text-[13px] text-ink-dim">{player.name}</span>
        <span className={`annot shrink-0 ${player.status === "injured" ? "text-out" : "text-susp"}`}>
          {player.status === "injured" ? "out" : "susp"}
        </span>
        <span aria-hidden className="num shrink-0 text-xs text-ink-dim">+</span>
      </button>
    );
  }

  return (
    <div data-testid="player-row" className={`border-b border-line ${row.absent ? "opacity-55" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6">
        <span className="num w-5 shrink-0 text-right text-[12px] text-ink-dim">{player.squad_number ?? "–"}</span>
        <button
          type="button"
          aria-expanded={row.open}
          aria-label={`${player.name}, ${row.absent ? "absent" : `effort ${eff.rpe ?? "not set"}, ${eff.minutes} minutes`}, tap to change`}
          onClick={() => onChange({ open: !row.open })}
          className="pressable flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
        >
          <span className={`min-w-0 truncate text-[13.5px] ${row.absent ? "text-ink-dim line-through" : "text-ink"}`}>
            {player.name}
          </span>
          {player.status === "doubt" ? <span className="annot shrink-0 text-doubt">doubt</span> : null}
          {out ? (
            <span className={`annot shrink-0 ${player.status === "injured" ? "text-out" : "text-susp"}`}>
              {player.status === "injured" ? "out" : "susp"}
            </span>
          ) : null}
        </button>

        {!row.absent ? (
          <>
            {isMatch ? (
              <div className="hidden items-center gap-1 sm:flex">
                <Counter label="G" value={row.goals} max={MAX_GOALS} onChange={(goals) => onChange({ goals })} tone="text-mint" ariaLabel={`${player.name} goals`} />
                <Counter label="A" value={row.assists} max={MAX_GOALS} onChange={(assists) => onChange({ assists })} tone="text-mint" ariaLabel={`${player.name} assists`} />
              </div>
            ) : null}
            <span
              className={`num shrink-0 text-right text-[12.5px] tabular-nums ${inheritsRpe && inheritsMin ? "text-ink-dim" : "text-ink"}`}
              data-inherits={inheritsRpe && inheritsMin ? "1" : "0"}
            >
              <span className={inheritsRpe ? "" : "text-mint"}>{eff.rpe ?? "–"}</span>
              <span className="text-ink-faint"> / </span>
              <span className={inheritsMin ? "" : "text-mint"}>{eff.minutes}&apos;</span>
            </span>
          </>
        ) : (
          <span className="annot shrink-0 text-ink-dim">absent</span>
        )}

        <button
          type="button"
          onClick={() => onChange({ absent: !row.absent, open: false })}
          aria-pressed={row.absent}
          aria-label={row.absent ? `mark ${player.name} present` : `mark ${player.name} absent`}
          className="pressable num flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] border border-line text-[13px] text-ink-dim hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
        >
          {row.absent ? "↩" : "×"}
        </button>
      </div>

      {row.open && !row.absent ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line bg-panel px-3 py-2.5 pl-10 sm:px-6 sm:pl-14">
          <RpeChips value={eff.rpe} onChange={(rpe) => onChange({ rpe })} ariaLabel={`${player.name} effort`} />
          <MinutesChips minutes={eff.minutes} onChange={(minutes) => onChange({ minutes })} ariaLabel={`${player.name} minutes`} />
          {isMatch ? (
            <div className="flex items-center gap-1">
              <span className="sm:hidden">
                <Counter label="G" value={row.goals} max={MAX_GOALS} onChange={(goals) => onChange({ goals })} tone="text-mint" ariaLabel={`${player.name} goals`} />
              </span>
              <span className="sm:hidden">
                <Counter label="A" value={row.assists} max={MAX_GOALS} onChange={(assists) => onChange({ assists })} tone="text-mint" ariaLabel={`${player.name} assists`} />
              </span>
              <Counter label="Y" value={row.yellow} max={2} onChange={(yellow) => onChange({ yellow })} tone="text-susp" ariaLabel={`${player.name} yellow cards`} />
              <Counter label="R" value={row.red} max={1} onChange={(red) => onChange({ red })} tone="text-out" ariaLabel={`${player.name} red card`} />
            </div>
          ) : null}
          {(!inheritsRpe || !inheritsMin) ? (
            <button
              type="button"
              onClick={() => onChange({ rpe: null, minutes: null })}
              className="pressable text-[11.5px] text-ink-dim underline-offset-4 hover:text-ink hover:underline"
            >
              back to default
            </button>
          ) : null}
          {out ? (
            <button
              type="button"
              onClick={() => onChange({ expanded: false, open: false })}
              className="pressable ml-auto text-[11.5px] text-ink-dim underline-offset-4 hover:text-ink hover:underline"
            >
              leave out
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
