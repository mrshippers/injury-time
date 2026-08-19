"use client";

import { useRef, useState, type KeyboardEvent } from "react";

/**
 * Shared roving-tabindex behaviour for a horizontal chip group: one tab stop
 * per group, arrow keys move focus within it. Used by every chip row in the
 * logger (RPE, minutes) so keyboard behaviour is identical everywhere.
 */
export function useRovingFocus(itemCount: number) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const [focusIndex, setFocusIndex] = useState(0);

  function move(from: number, delta: number) {
    if (itemCount === 0) return;
    const next = (from + delta + itemCount) % itemCount;
    setFocusIndex(next);
    refs.current[next]?.focus();
  }

  return {
    setRef: (i: number) => (el: HTMLButtonElement | null) => {
      refs.current[i] = el;
    },
    tabIndex: (i: number) => (i === focusIndex ? 0 : -1),
    onFocus: (i: number) => () => setFocusIndex(i),
    onKeyDown: (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        move(i, 1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        move(i, -1);
      }
    },
  };
}

const RPE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

/** RPE chip row: ten small numbered squares - the one required tap per player. */
export function RpeChips({
  value,
  onChange,
  ariaLabel,
}: {
  value: number | null;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const roving = useRovingFocus(RPE_VALUES.length);
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex gap-1">
      {RPE_VALUES.map((n, i) => {
        const selected = value === n;
        return (
          <button
            key={n}
            ref={roving.setRef(i)}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`rpe ${n}`}
            tabIndex={roving.tabIndex(i)}
            onFocus={roving.onFocus(i)}
            onKeyDown={roving.onKeyDown(i)}
            onClick={() => onChange(n)}
            className={`pressable num flex h-[26px] w-[26px] items-center justify-center rounded-[3px] border text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${
              selected
                ? "border-mint bg-mint text-mint-ink"
                : "border-line bg-panel-2 text-ink-dim hover:border-line-strong hover:text-ink"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
