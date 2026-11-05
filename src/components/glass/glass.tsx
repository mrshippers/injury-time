"use client";

import { useEffect, useId, useSyncExternalStore, type CSSProperties } from "react";

import { glassTint, mountGlass, setGlassTint } from "@/lib/glass";

/** React marks a DOM node with a fiber once it has hydrated it. Until then the
 *  node still belongs to the server's HTML, and writing to it is a mismatch. */
const hydrated = (el: HTMLElement) => Object.keys(el).some((key) => key.startsWith("__reactFiber$"));

/** Starts the glass for the whole app: one mount, in the root layout. */
export function Glass() {
  useEffect(() => mountGlass(hydrated), []);
  return null;
}

const TINT_EVENT = "glass:tint";
const subscribeTint = (onChange: () => void) => {
  window.addEventListener(TINT_EVENT, onChange);
  return () => window.removeEventListener(TINT_EVENT, onChange);
};

/**
 * How clear the glass is, kept on this device. 1 is the material as designed;
 * at 0 only the blur, the rim and the shadow are left.
 */
export function GlassTint() {
  const id = useId();
  // the stored value only exists in the browser: the server renders the material as designed
  const value = useSyncExternalStore(subscribeTint, glassTint, () => 1);
  return (
    <div className="mt-5 flex max-w-[420px] items-center gap-4">
      <label htmlFor={id} className="sr-only">
        glass tint
      </label>
      <span className="num text-[11px] tracking-[0.1em] text-ink-dim uppercase">clear</span>
      <input
        id={id}
        type="range"
        min={0}
        max={1.5}
        step={0.05}
        value={value}
        onChange={(e) => {
          setGlassTint(Number(e.target.value));
          window.dispatchEvent(new Event(TINT_EVENT));
        }}
        style={{ "--fill": `${(value / 1.5) * 100}%` } as CSSProperties}
        className="glass-range min-w-0 flex-1"
      />
      <span className="num text-[11px] tracking-[0.1em] text-ink-dim uppercase">smoked</span>
      <output htmlFor={id} className="num w-10 text-right text-[12px] text-ink">
        {value.toFixed(2)}
      </output>
    </div>
  );
}
