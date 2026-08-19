"use client";

import { useRovingFocus } from "./ChipGroup";

const PRESETS = [45, 60, 75, 90];

/**
 * Minutes chip row: four presets plus a "±" chip that reveals a -5/+5
 * stepper. Defaults are pre-selected (60 training / 90 match), so this is
 * only the second tap when a session ran long or short.
 */
export function MinutesChips({
  minutes,
  stepperOpen,
  onSelectPreset,
  onToggleStepper,
  onStep,
  ariaLabel,
}: {
  minutes: number;
  stepperOpen: boolean;
  onSelectPreset: (minutes: number) => void;
  onToggleStepper: () => void;
  onStep: (delta: number) => void;
  ariaLabel: string;
}) {
  const roving = useRovingFocus(PRESETS.length + 1);
  const isPreset = PRESETS.includes(minutes);

  return (
    <div className="flex items-center gap-1.5">
      <div role="group" aria-label={ariaLabel} className="flex items-center gap-1">
        {PRESETS.map((m, i) => {
          const selected = minutes === m;
          return (
            <button
              key={m}
              ref={roving.setRef(i)}
              type="button"
              aria-pressed={selected}
              aria-label={`${m} minutes`}
              tabIndex={roving.tabIndex(i)}
              onFocus={roving.onFocus(i)}
              onKeyDown={roving.onKeyDown(i)}
              onClick={() => onSelectPreset(m)}
              className={`pressable num h-7 rounded-[3px] border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
                selected
                  ? "border-mint bg-mint text-mint-ink"
                  : "border-line bg-panel-2 text-ink-dim hover:border-line-strong hover:text-ink"
              }`}
            >
              {m}
            </button>
          );
        })}
        <button
          ref={roving.setRef(PRESETS.length)}
          type="button"
          aria-expanded={stepperOpen}
          aria-label={isPreset ? "adjust minutes" : `${minutes} minutes, adjust`}
          tabIndex={roving.tabIndex(PRESETS.length)}
          onFocus={roving.onFocus(PRESETS.length)}
          onKeyDown={roving.onKeyDown(PRESETS.length)}
          onClick={onToggleStepper}
          className={`pressable num h-7 min-w-7 rounded-[3px] border px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
            !isPreset
              ? "border-mint bg-mint text-mint-ink"
              : "border-line bg-panel-2 text-ink-dim hover:border-line-strong hover:text-ink"
          }`}
        >
          {isPreset ? "±" : minutes}
        </button>
      </div>
      {stepperOpen && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="minus 5 minutes"
            onClick={() => onStep(-5)}
            className="pressable num flex h-7 w-7 items-center justify-center rounded-[3px] border border-line bg-panel-2 text-ink-dim hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
          >
            −
          </button>
          <button
            type="button"
            aria-label="plus 5 minutes"
            onClick={() => onStep(5)}
            className="pressable num flex h-7 w-7 items-center justify-center rounded-[3px] border border-line bg-panel-2 text-ink-dim hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
