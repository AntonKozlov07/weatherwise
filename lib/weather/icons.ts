import { conditionInfo } from "./openweather/conditions";
import type { ConditionRef } from "./types";

/**
 * Condition codes to Meteocons file names.
 *
 * The icon base name lives in the condition table alongside the label, so a
 * code cannot pick up one and not the other. This module only resolves the day
 * or night variant.
 */

/** Icons that exist in both a `-day` and a `-night` form. */
const DAY_NIGHT = new Set([
  "clear",
  "fog",
  "haze",
  "overcast",
  "partly-cloudy",
  "partly-cloudy-drizzle",
  "partly-cloudy-fog",
  "partly-cloudy-hail",
  "partly-cloudy-rain",
  "partly-cloudy-sleet",
  "partly-cloudy-snow",
  "thunderstorms",
  "thunderstorms-rain",
  "thunderstorms-snow",
]);

/**
 * A base name, resolved to its day or night variant when one exists. Names with
 * a suffix insert the variant before it: `partly-cloudy-rain` becomes
 * `partly-cloudy-day-rain`, which is how Meteocons names its files.
 */
function variant(base: string, isDay: boolean): string {
  if (!DAY_NIGHT.has(base)) return base;

  const period = isDay ? "day" : "night";

  if (base.startsWith("partly-cloudy")) {
    return `partly-cloudy-${period}${base.slice("partly-cloudy".length)}`;
  }

  if (base.startsWith("thunderstorms")) {
    return `thunderstorms-${period}${base.slice("thunderstorms".length)}`;
  }

  return `${base}-${period}`;
}

export function weatherIconName(condition: ConditionRef): string {
  return variant(conditionInfo(condition.code).icon, condition.isDay);
}

export function weatherIconSrc(condition: ConditionRef): string {
  return `/weather-icons/${weatherIconName(condition)}.svg`;
}

/**
 * Every file the app can ask for, for the test that asserts each one exists.
 * The mapping is written by hand against the Meteocons listing, so a typo would
 * otherwise only show up as a missing image at runtime.
 */
export function allIconNames(codes: number[]): string[] {
  const names = new Set<string>();

  for (const code of codes) {
    const base = conditionInfo(code).icon;
    names.add(variant(base, true));
    names.add(variant(base, false));
  }

  return [...names].sort();
}
