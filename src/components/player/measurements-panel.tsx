"use client";

/**
 * The player's measurements, in cm, one slider each. The figure follows the
 * slider live; the value is saved when the slider is let go. Reset clears the
 * player's own numbers and the default athlete comes back.
 */
import { useId } from "react";

import { MORPHS, rangeCm, resolveParams } from "@/lib/body/params";
import type { BodyParams } from "@/lib/types";

export default function MeasurementsPanel({
  params,
  onChange,
  onCommit,
  onReset,
  saving,
  savedAt,
}: {
  params: BodyParams | null;
  onChange: (next: BodyParams) => void;
  onCommit: (next: BodyParams) => void;
  onReset: () => void;
  saving: boolean;
  savedAt: number | null;
}) {
  const resolved = resolveParams(params);
  const base = useId();
  const set = (key: keyof BodyParams, value: number, commit: boolean) => {
    const next: BodyParams = { ...(params ?? {}), [key]: value };
    onChange(next);
    if (commit) onCommit(next);
  };

  return (
    <section aria-labelledby={`${base}-h`} className="border border-line bg-panel px-3 py-3" data-testid="measurements-panel">
      <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2">
        <p className="annot" id={`${base}-h`}>{"// measurements (cm)"}</p>
        <span className="num text-[10.5px] text-ink-faint" aria-live="polite">
          {saving ? "saving" : savedAt ? "saved" : ""}
        </span>
      </div>
      <ul className="mt-2 flex flex-col gap-[7px]">
        {MORPHS.map((m) => {
          const r = rangeCm(m);
          const value = resolved[m.key];
          const id = `${base}-${m.key}`;
          return (
            <li key={m.key} className="grid grid-cols-[86px_minmax(0,1fr)_44px] items-center gap-2">
              <label htmlFor={id} className="truncate text-[11.5px] leading-none text-ink-dim">
                {m.label}
              </label>
              <input
                id={id}
                type="range"
                min={Math.ceil(r.min)}
                max={Math.floor(r.max)}
                step={0.5}
                value={value}
                onChange={(e) => set(m.key, Number(e.target.value), false)}
                onPointerUp={(e) => set(m.key, Number((e.target as HTMLInputElement).value), true)}
                onKeyUp={(e) => {
                  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End", "PageUp", "PageDown"].includes(e.key)) {
                    set(m.key, Number((e.target as HTMLInputElement).value), true);
                  }
                }}
                onPointerDown={(e) => e.stopPropagation()}
                className="measure-range h-5 w-full cursor-ew-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
                aria-valuetext={`${value} centimetres`}
              />
              <span className="num text-right text-[11.5px] leading-none text-ink">{value.toFixed(value % 1 === 0 ? 0 : 1)}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2">
        <p className="text-[10.5px] leading-snug text-ink-faint">tape measure numbers, the figure follows</p>
        <button
          type="button"
          onClick={onReset}
          className="pressable border border-line-strong bg-panel-2 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] uppercase text-ink-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
        >
          reset
        </button>
      </div>
      <style>{`
        .measure-range { -webkit-appearance: none; appearance: none; background: transparent; }
        .measure-range::-webkit-slider-runnable-track { height: 2px; background: var(--line-strong); }
        .measure-range::-moz-range-track { height: 2px; background: var(--line-strong); }
        .measure-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 10px; height: 14px; margin-top: -6px; background: var(--mint); border: 0; border-radius: 1px; }
        .measure-range::-moz-range-thumb { width: 10px; height: 14px; background: var(--mint); border: 0; border-radius: 1px; }
      `}</style>
    </section>
  );
}
