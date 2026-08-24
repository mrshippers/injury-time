"use client";

import { useRovingFocus } from "./ChipGroup";
import { clampMinutes } from "./session-state";

const PRESETS = [45, 60, 75, 90];

/**
 * Minutes chips: four presets and an always-visible -5 / +5 pair. No hidden
 * stepper to reveal; the odd 20-minute cameo is two taps, not four.
 */
export function MinutesChips({
  minutes,
  onChange,
  ariaLabel,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
  ariaLabel: string;
}) {
  const roving = useRovingFocus(PRESETS.length + 2);
  const isPreset = PRESETS.includes(minutes);
  const chip = (selected: boolean) =>
    `pressable num h-7 rounded-[3px] border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
      selected
        ? "border-mint bg-mint text-mint-ink"
        : "border-line bg-panel-2 text-ink-dim hover:border-line-strong hover:text-ink"
    }`;

  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center gap-1">
      {PRESETS.map((m, i) => (
        <button
          key={m}
          ref={roving.setRef(i)}
          type="button"
          aria-pressed={minutes === m}
          aria-label={`${m} minutes`}
          tabIndex={roving.tabIndex(i)}
          onFocus={roving.onFocus(i)}
          onKeyDown={roving.onKeyDown(i)}
          onClick={() => onChange(m)}
          className={chip(minutes === m)}
        >
          {m}
        </button>
      ))}
      <span className="mx-1 h-4 w-px bg-line-strong" aria-hidden />
      <button
        ref={roving.setRef(PRESETS.length)}
        type="button"
        aria-label="minus 5 minutes"
        tabIndex={roving.tabIndex(PRESETS.length)}
        onFocus={roving.onFocus(PRESETS.length)}
        onKeyDown={roving.onKeyDown(PRESETS.length)}
        onClick={() => onChange(clampMinutes(minutes - 5))}
        className={chip(false) + " w-7 px-0"}
      >
        −
      </button>
      {!isPreset ? (
        <span className="num w-8 text-center text-xs text-mint" aria-live="polite">
          {minutes}
        </span>
      ) : null}
      <button
        ref={roving.setRef(PRESETS.length + 1)}
        type="button"
        aria-label="plus 5 minutes"
        tabIndex={roving.tabIndex(PRESETS.length + 1)}
        onFocus={roving.onFocus(PRESETS.length + 1)}
        onKeyDown={roving.onKeyDown(PRESETS.length + 1)}
        onClick={() => onChange(clampMinutes(minutes + 5))}
        className={chip(false) + " w-7 px-0"}
      >
        +
      </button>
    </div>
  );
}
