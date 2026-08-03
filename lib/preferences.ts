import type { Units } from "./format";
import { parseRules, type ThresholdRule } from "@/lib/push/rules";
import { EMPTY_PROFILE, type WeatherProfile } from "@/lib/profile/profile";
import { parseProfile } from "@/lib/profile/parse";

export type { Units };

export type Theme = "dark" | "midnight";
export type FontSize = "small" | "medium" | "large";

export type SavedLocation = {
  /** Coordinates rounded to four places, which is stable enough to dedupe on. */
  id: string;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
};

export type Preferences = {
  /** Blank renders the greeting without a name (Decisions Log 5). */
  name: string;
  units: Units;
  theme: Theme;
  fontSize: FontSize;
  /**
   * In-app alert banners only. There are no push notifications in v1
   * (Decisions Log 7), and the settings label has to say so.
   */
  alertBanners: boolean;
  /**
   * Tilt-reactive highlights on the hero. Off by default: iOS will only hand
   * over device orientation after an explicit permission prompt, and that
   * prompt can only be raised from a tap, so the toggle is where the user opts
   * in and where the prompt fires (Decisions Log 67).
   */
  motionEffects: boolean;
  /**
   * Personal threshold rules for push. Kept apart from `alertBanners`, which is
   * about official warnings: one is an authority telling everyone the same
   * thing, the other is this user's own line in the sand (Decisions Log 69).
   */
  alertRules: ThresholdRule[];
  /**
   * Likes and dislikes, used only to steer the home screen's paragraph. Empty
   * where the reader skipped the questions, which must be indistinguishable
   * from never having been asked (Decisions Log 117).
   */
  weatherProfile: WeatherProfile;
  locations: SavedLocation[];
  activeLocationId: string | null;
  onboarded: boolean;
};

export const STORAGE_KEY = "weatherwise.preferences";

/** Root font size per Decisions Log 4. Everything else is in rem. */
export const FONT_SIZES: Record<FontSize, string> = {
  small: "15px",
  medium: "16px",
  large: "18px",
};

export const DEFAULT_PREFERENCES: Preferences = {
  name: "",
  units: "metric",
  theme: "dark",
  fontSize: "medium",
  alertBanners: true,
  motionEffects: false,
  alertRules: [],
  weatherProfile: EMPTY_PROFILE,
  locations: [],
  activeLocationId: null,
  onboarded: false,
};

export function locationId(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}`;
}

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function parseLocation(value: unknown): SavedLocation | null {
  if (typeof value !== "object" || value === null) return null;
  const candidate = value as Partial<SavedLocation>;

  if (
    typeof candidate.latitude !== "number" ||
    typeof candidate.longitude !== "number" ||
    typeof candidate.name !== "string"
  ) {
    return null;
  }

  return {
    id:
      typeof candidate.id === "string"
        ? candidate.id
        : locationId(candidate.latitude, candidate.longitude),
    name: candidate.name,
    region: typeof candidate.region === "string" ? candidate.region : "",
    country: typeof candidate.country === "string" ? candidate.country : "",
    latitude: candidate.latitude,
    longitude: candidate.longitude,
  };
}

/**
 * Merges stored preferences over the defaults, field by field.
 *
 * localStorage is user-writable and survives across versions of the app, so
 * anything unrecognised is dropped rather than trusted. A single bad key must
 * not brick the app into an unreadable font size or a missing theme.
 */
export function parsePreferences(raw: string | null): Preferences {
  if (!raw) return DEFAULT_PREFERENCES;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_PREFERENCES;
  }

  if (typeof parsed !== "object" || parsed === null) return DEFAULT_PREFERENCES;
  const stored = parsed as Record<string, unknown>;

  const locations = Array.isArray(stored.locations)
    ? stored.locations.map(parseLocation).filter((l): l is SavedLocation => l !== null)
    : DEFAULT_PREFERENCES.locations;

  const activeLocationId =
    typeof stored.activeLocationId === "string" &&
    locations.some((location) => location.id === stored.activeLocationId)
      ? stored.activeLocationId
      : (locations[0]?.id ?? null);

  return {
    name: typeof stored.name === "string" ? stored.name : DEFAULT_PREFERENCES.name,
    units: isOneOf(stored.units, ["metric", "imperial"] as const)
      ? stored.units
      : DEFAULT_PREFERENCES.units,
    theme: isOneOf(stored.theme, ["dark", "midnight"] as const)
      ? stored.theme
      : DEFAULT_PREFERENCES.theme,
    fontSize: isOneOf(stored.fontSize, ["small", "medium", "large"] as const)
      ? stored.fontSize
      : DEFAULT_PREFERENCES.fontSize,
    alertBanners:
      typeof stored.alertBanners === "boolean"
        ? stored.alertBanners
        : DEFAULT_PREFERENCES.alertBanners,
    motionEffects:
      typeof stored.motionEffects === "boolean"
        ? stored.motionEffects
        : DEFAULT_PREFERENCES.motionEffects,
    // The same guard the server uses, so a hand-edited localStorage cannot put
    // a malformed rule into the UI or onto the wire.
    alertRules: parseRules(stored.alertRules),
    weatherProfile: parseProfile(stored.weatherProfile),
    locations,
    activeLocationId,
    onboarded:
      typeof stored.onboarded === "boolean"
        ? stored.onboarded
        : DEFAULT_PREFERENCES.onboarded,
  };
}

export function activeLocation(preferences: Preferences): SavedLocation | null {
  return (
    preferences.locations.find(
      (location) => location.id === preferences.activeLocationId,
    ) ?? null
  );
}
