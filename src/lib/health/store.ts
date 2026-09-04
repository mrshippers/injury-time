"use client";

/**
 * The health-language switch, per browser. The club's setting is the default;
 * a choice made here overrides it on this device only. A plain external store
 * so every component on the page flips together.
 */
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

import { HEALTH_LANGUAGES, HEALTH_LANGUAGE_STORAGE_KEY, type HealthLanguage } from "@/lib/config";

const EVENT = "injury-time:health-language";

function read(): HealthLanguage | null {
  try {
    const v = localStorage.getItem(HEALTH_LANGUAGE_STORAGE_KEY);
    return HEALTH_LANGUAGES.includes(v as HealthLanguage) ? (v as HealthLanguage) : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function setHealthLanguage(mode: HealthLanguage): void {
  try {
    localStorage.setItem(HEALTH_LANGUAGE_STORAGE_KEY, mode);
  } catch {
    // private mode: the choice lasts for this page only
  }
  window.dispatchEvent(new Event(EVENT));
}

export const HealthDefaultContext = createContext<HealthLanguage>("plain");

/** The mode in force: the browser's override, else the club default. */
export function useHealthLanguage(): [HealthLanguage, (mode: HealthLanguage) => void] {
  const fallback = useContext(HealthDefaultContext);
  const stored = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((mode: HealthLanguage) => setHealthLanguage(mode), []);
  return [stored ?? fallback, set];
}
