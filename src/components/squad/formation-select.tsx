"use client";

import { useId } from "react";

import { FORMATION_TEMPLATES } from "@/lib/config";

/**
 * The shapes actually in use, most common first. A native select: it is
 * chosen a few times a season, so it gets the platform control, styled to
 * the board and nothing more.
 */
export function FormationSelect({ value, onChange }: { value: string; onChange: (name: string) => void }) {
  const id = useId();
  const current = FORMATION_TEMPLATES.find((t) => t.name === value);
  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <span className="annot">{"// shape"}</span>
      <span className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="num h-8 max-w-[calc(100vw-140px)] sm:max-w-[380px] appearance-none border border-line-strong bg-panel pl-2.5 pr-7 text-[13px] font-semibold text-ink [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-mint"
          title={current?.note}
        >
          {FORMATION_TEMPLATES.map((t) => (
            <option key={t.name} value={t.name}>
              {t.name} · {t.note}
            </option>
          ))}
        </select>
        <span aria-hidden className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-dim">
          ▾
        </span>
      </span>
    </label>
  );
}
