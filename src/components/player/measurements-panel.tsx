"use client";

/**
 * The player's measurements, in cm, one slider each. The figure follows the
 * slider live; the value is saved when the slider is let go. Reset clears the
 * player's own numbers and the default athlete comes back. Every row is a
 * thumb-height strip: the slider's hit area is the whole row, the drawn
 * track stays a hairline.
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
        <span className="num text-[11.5px] text-ink-faint" aria-live="polite">
          {saving ? "saving" : savedAt ? "saved" : ""}
        </span>
      </div>
      <ul className="mt-1 flex flex-col">
        {MORPHS.map((m) => {
          const r = rangeCm(m);
          const value = resolved[m.key];
          const id = `${base}-${m.key}`;
          return (
            <li key={m.key} className="grid min-h-11 grid-cols-[92px_minmax(0,1fr)_48px] items-center gap-2 sm:min-h-8 sm:grid-cols-[86px_minmax(0,1fr)_44px]">
              <label htmlFor={id} className="truncate text-[12.5px] leading-none text-ink-dim sm:text-[11.5px]">
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
                className="measure-range h-11 w-full cursor-ew-resize touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:h-7"
                aria-valuetext={`${value} centimetres`}
              />
              <span className="num text-right text-[13px] leading-none text-ink sm:text-[11.5px]">{value.toFixed(value % 1 === 0 ? 0 : 1)}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2">
        <p className="text-[11.5px] leading-snug text-ink-faint sm:text-[10.5px]">tape measure numbers, the figure follows</p>
        <button
          type="button"
          onClick={onReset}
          className="pressable h-11 border border-line-strong bg-panel-2 px-3 text-[11.5px] font-semibold uppercase tracking-[0.1em] text-ink-dim hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint sm:h-auto sm:px-2.5 sm:py-1 sm:text-[10.5px]"
        >
          reset
        </button>
      </div>
      <style>{`
        .measure-range { -webkit-appearance: none; appearance: none; background: transparent; }
        .measure-range::-webkit-slider-runnable-track { height: 2px; background: var(--line-strong); }
        .measure-range::-moz-range-track { height: 2px; background: var(--line-strong); }
        .measure-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 26px; margin-top: -12px; background: var(--mint); border: 0; border-radius: 1px; }
        .measure-range::-moz-range-thumb { width: 14px; height: 26px; background: var(--mint); border: 0; border-radius: 1px; }
        @media (min-width: 640px) {
          .measure-range::-webkit-slider-thumb { width: 10px; height: 14px; margin-top: -6px; }
          .measure-range::-moz-range-thumb { width: 10px; height: 14px; }
        }
      `}</style>
    </section>
  );
}
