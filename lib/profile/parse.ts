import {
  ACTIVITY_LABELS,
  AVOIDANCE_LABELS,
  EMPTY_PROFILE,
  type ActivityId,
  type Avoidance,
  type Tolerance,
  type WeatherProfile,
} from "@/lib/profile/profile";

/**
 * Guards the profile coming out of storage.
 *
 * localStorage is user-writable and survives across versions, so anything
 * unrecognised is dropped rather than trusted. Kept apart from `profile.ts` so
 * that module stays free of parsing and can be read as the domain alone.
 */

const TOLERANCES: Tolerance[] = ["like", "neutral", "dislike"];

function tolerance(value: unknown): Tolerance {
  return typeof value === "string" && TOLERANCES.includes(value as Tolerance)
    ? (value as Tolerance)
    : "neutral";
}

export function parseProfile(value: unknown): WeatherProfile {
  if (typeof value !== "object" || value === null) return EMPTY_PROFILE;

  const stored = value as Partial<WeatherProfile>;

  const activities = Array.isArray(stored.activities)
    ? stored.activities.filter(
        (id): id is ActivityId => typeof id === "string" && id in ACTIVITY_LABELS,
      )
    : [];

  const avoid = Array.isArray(stored.avoid)
    ? stored.avoid.filter(
        (id): id is Avoidance => typeof id === "string" && id in AVOIDANCE_LABELS,
      )
    : [];

  return {
    // Deduplicated: a repeated activity would be suggested twice.
    activities: [...new Set(activities)],
    avoid: [...new Set(avoid)],
    heat: tolerance(stored.heat),
    cold: tolerance(stored.cold),
    wind: tolerance(stored.wind),
    humidity: tolerance(stored.humidity),
  };
}
