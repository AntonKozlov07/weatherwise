"use client";

import { useEffect, useSyncExternalStore } from "react";

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


  return <>{children}</>;
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export { updatePreferences, resetPreferences };
