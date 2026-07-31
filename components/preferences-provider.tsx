"use client";

import { useEffect, useSyncExternalStore } from "react";

import { setHapticsEnabled } from "@/lib/haptics";

import {
  applyAppearance,
  getServerSnapshot,
  getSnapshot,
  resetPreferences,
  subscribe,
  updatePreferences,
} from "@/lib/preferences-store";
import type { Preferences } from "@/lib/preferences";

/**
 * There is no context here on purpose. Preferences live in localStorage, and
 * `useSyncExternalStore` reads them from any component without one, so a
 * provider would only add a wrapper for the store to be threaded through.
 *
 * This component exists to keep the DOM in step with the stored appearance.
 */
export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const preferences = usePreferences();

  useEffect(() => applyAppearance(preferences), [preferences]);

  // The haptics module is plain functions, not a hook, so that any event
  // handler can fire feedback without threading a prop to it. This is the one
  // place the preference is pushed into it.
  useEffect(() => setHapticsEnabled(preferences.haptics), [preferences.haptics]);

  return <>{children}</>;
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { updatePreferences, resetPreferences };
