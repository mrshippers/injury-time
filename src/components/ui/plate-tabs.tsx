"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A row of tabs with one slanted plate that slides to the active one. Text, never boxes; the plate is the
 * only shape. Controlled: the parent owns which is active.
 */
export function PlateTabs<T extends string>({
  items,
  active,
  onChange,
  label,
  size = "md",
  className = "",
}: {
  items: { key: T; label: ReactNode }[];
  active: T;
  onChange: (key: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const el = row.current?.querySelector<HTMLButtonElement>(`[data-key="${active}"]`);
    if (!el || !row.current) return;
    const measure = () => setBox({ x: el.offsetLeft, w: el.offsetWidth });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row.current);
    return () => ro.disconnect();
  }, [active, items.length]);
  const pad = size === "sm" ? "px-3 py-1.5 text-[11.5px]" : "px-3.5 py-2 text-[12.5px]";
  return (
    <div ref={row} role="tablist" aria-label={label} className={`plate-tabs ${className}`}>
      {box ? <span aria-hidden data-indicator className="plate" style={{ transform: `translateX(${box.x}px)`, width: box.w }} /> : null}
      {items.map((it) => {
        const on = it.key === active;
        return (
          <button
            key={it.key}
            type="button"
            role="tab"
            aria-selected={on}
            data-key={it.key}
            onClick={() => onChange(it.key)}
            className={`pressable num relative whitespace-nowrap font-semibold uppercase tracking-[0.1em] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${pad} ${on ? "text-ink" : "text-ink-dim hover:text-ink"}`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}
