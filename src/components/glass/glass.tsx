"use client";

import { useEffect } from "react";

import { mountGlass } from "@/lib/glass";

/** React marks a DOM node with a fiber once it has hydrated it. Until then the
 *  node still belongs to the server's HTML, and writing to it is a mismatch. */
const hydrated = (el: HTMLElement) => Object.keys(el).some((key) => key.startsWith("__reactFiber$"));

/** Starts the glass for the whole app: one mount, in the root layout. */
export function Glass() {
  useEffect(() => mountGlass(hydrated), []);
  return null;
}
