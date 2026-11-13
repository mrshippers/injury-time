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
  fraction,
}: {
  items: { key: T; label: ReactNode }[];
  active: T;
  onChange: (key: T) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
  /** where the content is between tabs (1.4 = forty percent from the second to the third); the plate follows it live */
  fraction?: number;
}) {
  const row = useRef<HTMLDivElement>(null);
  const [boxes, setBoxes] = useState<{ x: number; w: number }[]>([]);
  useLayoutEffect(() => {
    if (!row.current) return;
    const measure = () => setBoxes([...row.current!.querySelectorAll<HTMLButtonElement>("[data-key]")].map((b) => ({ x: b.offsetLeft, w: b.offsetWidth })));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row.current);
    return () => ro.disconnect();
  }, [items.length]);
  const activeIndex = Math.max(0, items.findIndex((it) => it.key === active));
  const at = fraction === undefined ? activeIndex : Math.min(items.length - 1, Math.max(0, fraction));
  const lo = boxes[Math.floor(at)];
  const hi = boxes[Math.min(boxes.length - 1, Math.ceil(at))];
  const t = at - Math.floor(at);
  const box = lo && hi ? { x: lo.x + (hi.x - lo.x) * t, w: lo.w + (hi.w - lo.w) * t } : null;
  // dragging: the plate is pinned to the thumb, so no transition fights it
  const live = fraction !== undefined && Math.abs(at - Math.round(at)) > 0.005;
  const pad = size === "sm" ? "px-3 py-1.5 text-[11.5px]" : "px-3.5 py-2 text-[12.5px]";
  return (
    <div ref={row} role="tablist" aria-label={label} className={`plate-tabs ${className}`}>
      {box ? <span aria-hidden data-indicator data-live={live ? "true" : undefined} className="plate" style={{ transform: `translateX(${box.x}px)`, width: box.w }} /> : null}
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
