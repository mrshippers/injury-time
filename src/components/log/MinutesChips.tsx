"use client";

import { useRovingFocus } from "./ChipGroup";
import { clampMinutes } from "./session-state";

const PRESETS = [45, 60, 75, 90];

/**
 * Minutes chips: four presets and an always-visible -5 / +5 pair. No hidden
 * stepper to reveal; the odd 20-minute cameo is two taps, not four. Thumb
 * height on a phone, a small row on a desk.
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
    `pressable num h-11 min-w-11 rounded-[3px] border px-2.5 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:h-7 sm:min-w-0 sm:px-2 sm:text-xs ${
      selected
        ? "border-mint bg-mint text-mint-ink"
        : "border-line bg-panel-2 text-ink-dim hover:border-line-strong hover:text-ink"
    }`;

  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap items-center gap-1.5 sm:gap-1">
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
        className={chip(false) + " w-11 px-0 sm:w-7"}
      >
        −
      </button>
      {!isPreset ? (
        <span className="num w-9 text-center text-[14px] text-mint sm:w-8 sm:text-xs" aria-live="polite">
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
        className={chip(false) + " w-11 px-0 sm:w-7"}
      >
        +
      </button>
    </div>
  );
}
