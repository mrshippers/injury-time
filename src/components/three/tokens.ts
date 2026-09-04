"use client";

import { useSyncExternalStore } from "react";

/**
 * Design tokens for the 3D scenes, read from the CSS custom properties at
 * mount so three.js materials use the same values as the DOM. Never a hex
 * literal in a scene file.
 */
export type SceneTokens = {
  pitch: string;
  panel: string;
  panel2: string;
  ink: string;
  inkDim: string;
  mint: string;
  gold: string;
  fit: string;
  doubt: string;
  out: string;
  susp: string;
  cold: string;
  turf: string;
  turf2: string;
  chalk: string;
  skin: string;
  skinHi: string;
};

const NAMES: Record<keyof SceneTokens, string> = {
  pitch: "--pitch",
  panel: "--panel",
  panel2: "--panel-2",
  ink: "--ink",
  inkDim: "--ink-dim",
  mint: "--mint",
  gold: "--gold",
  fit: "--fit",
  doubt: "--doubt",
  out: "--out",
  susp: "--susp",
  cold: "--cold",
  turf: "--turf",
  turf2: "--turf-2",
  chalk: "--chalk",
  skin: "--skin",
  skinHi: "--skin-hi",
};

export function readTokens(): SceneTokens {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as SceneTokens;
  for (const key of Object.keys(NAMES) as (keyof SceneTokens)[]) {
    out[key] = cs.getPropertyValue(NAMES[key]).trim();
  }
  return out;
}

// Tokens never change during a session, so one read is cached and handed to
// every scene; the server snapshot is null, which is what keeps hydration
// honest (the scene mounts only after the DOM is real).
let cachedTokens: SceneTokens | null = null;
const noSubscribe = () => () => {};
function tokensSnapshot(): SceneTokens | null {
  if (!cachedTokens) cachedTokens = readTokens();
  return cachedTokens;
}

export function useSceneTokens(): SceneTokens | null {
  return useSyncExternalStore(noSubscribe, tokensSnapshot, () => null);
}

const MQ = "(prefers-reduced-motion: reduce)";
function subscribeMotion(cb: () => void) {
  const mq = window.matchMedia(MQ);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

const PHONE = "(max-width: 639px)";
function subscribePhone(cb: () => void) {
  const mq = window.matchMedia(PHONE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

/** Below the `sm` breakpoint: the touchline phone, one thumb, no hover. */
export function useIsPhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, () => window.matchMedia(MQ).matches, () => false);
}

/** A localStorage key as an external store: null on the server, live on the client. */
export function useStoredValue(key: string): string | null {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener("storage", cb);
      return () => window.removeEventListener("storage", cb);
    },
    () => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
}

/**
 * Drop the alpha channel: three's Color parser takes `rgb()` and 6-digit hex
 * but not `rgba()` or the 8-digit hex the CSS pipeline may fold an rgba
 * token into (`#eef2eeb8`).
 */
export function opaque(css: string): string {
  const hex = css.match(/^#([0-9a-f]{8}|[0-9a-f]{4})$/i);
  if (hex) return hex[1].length === 8 ? css.slice(0, 7) : css.slice(0, 4);
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) return css;
  const [r, g, b] = m[1].split(/[\s,\/]+/).filter(Boolean);
  return `rgb(${r}, ${g}, ${b})`;
}
