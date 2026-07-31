"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether the user has asked for reduced motion.
 *
 * `useSyncExternalStore` rather than an effect: the media query is external
 * state that can change while the app is open, and subscribing to it is exactly
 * what the hook is for. Reading it into state in an effect would render one
 * frame of motion before the setting took hold.
 *
 * Returns false on the server, which is the same answer the browser gives
 * before it has a preference to report, so hydration matches.
 */
const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(callback: () => void): () => void {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", callback);

  return () => query.removeEventListener("change", callback);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
