"use client";

import { useState } from "react";

export function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1600);
        } catch {}
      }}
      className="plate plate-sm pressable num bg-panel-2 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink transition-colors duration-200 hover:bg-panel"
    >
      {done ? "copied" : label}
    </button>
  );
}
