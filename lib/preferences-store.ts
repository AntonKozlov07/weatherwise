"use client";

import {
  DEFAULT_PREFERENCES,
  FONT_SIZES,
  STORAGE_KEY,
  parsePreferences,
  type Preferences,
} from "./preferences";

/**
 * localStorage as an external store, read through `useSyncExternalStore`.
 *
 * The obvious alternative, reading storage in an effect and calling setState,
 * causes a cascading render on every mount and trips React's own lint rules.
 * This also gets cross-tab updates for free through the `storage` event.
 *
 * Snapshots are cached by raw string so `getSnapshot` returns a referentially
 * stable object; returning a fresh parse each call would loop forever.
 */

let cachedRaw: string | null = null;
let cachedValue: Preferences = DEFAULT_PREFERENCES;
let hydrated = false;

const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent): void {
  if (event.key === STORAGE_KEY || event.key === null) {
    hydrated = false;
    emit();
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("storage", onStorage);
    }
  };
}

export function getSnapshot(): Preferences {
  const raw = window.localStorage.getItem(STORAGE_KEY);

  if (!hydrated || raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parsePreferences(raw);
    hydrated = true;
  }

  return cachedValue;
}

/** The server has no storage, so it renders the defaults and hydrates over them. */
export function getServerSnapshot(): Preferences {
  return DEFAULT_PREFERENCES;
}

function write(next: Preferences): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  cachedRaw = null;
  hydrated = false;
  emit();
}

export function updatePreferences(patch: Partial<Preferences>): void {
  write({ ...getSnapshot(), ...patch });
}

export function resetPreferences(): void {
  write(DEFAULT_PREFERENCES);
}

/**
 * Reads storage directly, outside of React's render cycle.
 *
 * The onboarding gate needs the real stored value the moment it runs, not the
 * server snapshot the first commit may still be holding. Redirecting off a
 * default would bounce a returning user through onboarding on every launch.
 */
export function readPreferences(): Preferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  return getSnapshot();
}

export function applyAppearance(preferences: Preferences): void {
  const root = document.documentElement;
  root.dataset.theme = preferences.theme;
  root.style.setProperty("--app-font-size", FONT_SIZES[preferences.fontSize]);
}
