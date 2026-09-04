"use client";

import { useSyncExternalStore } from "react";

/** Below Tailwind's `sm`: the phone. Server snapshot is false, so markup never flips on hydration. */
const NARROW = "(max-width: 639px)";

function subscribe(cb: () => void) {
  const mq = window.matchMedia(NARROW);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

export function useNarrow(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW).matches, () => false);
}
