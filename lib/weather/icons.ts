import type { ConditionRef } from "./types";

/**
 * Condition codes to Meteocons file names.
 *
 * The icons WeatherAPI returns in its own payload are deliberately unused
 * (CLAUDE.md, Never list): they do not match this design.
 *
 * Two vocabularies map in here because the sources use different ones. Day and
 * night variants are picked from `isDay`, so a clear night gets a moon.
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
  const [head, ...rest] = base.split("-");

  // `partly-cloudy-*` and `thunderstorms-*` keep their trailing modifier.
  if (base.startsWith("partly-cloudy")) {
    const suffix = base.slice("partly-cloudy".length);
    return `partly-cloudy-${period}${suffix}`;
  }

  if (base.startsWith("thunderstorms")) {
    const suffix = base.slice("thunderstorms".length);
    return `thunderstorms-${period}${suffix}`;
  }

  return [head, ...rest, period].join("-");
}

const WEATHER_API_ICONS: Record<number, string> = {
  1000: "clear",
  1003: "partly-cloudy",
  1006: "cloudy",
  1009: "overcast",
  1030: "mist",
  1063: "partly-cloudy-rain",
  1066: "partly-cloudy-snow",
  1069: "partly-cloudy-sleet",
  1072: "partly-cloudy-drizzle",
  1087: "thunderstorms",
  1114: "snow",
  1117: "snow",
  1135: "fog",
  1147: "fog",
  1150: "drizzle",
  1153: "drizzle",
  1168: "drizzle",
  1171: "drizzle",
  1180: "partly-cloudy-rain",
  1183: "rain",
  1186: "rain",
  1189: "rain",
  1192: "rain",
  1195: "rain",
  1198: "sleet",
  1201: "sleet",
  1204: "sleet",
  1207: "sleet",
  1210: "partly-cloudy-snow",
  1213: "snow",
  1216: "snow",
  1219: "snow",
  1222: "snow",
  1225: "snow",
  1237: "hail",
  1240: "partly-cloudy-rain",
  1243: "rain",
  1246: "rain",
  1249: "sleet",
  1252: "sleet",
  1255: "partly-cloudy-snow",
  1258: "snow",
  1261: "hail",
  1264: "hail",
  1273: "thunderstorms-rain",
  1276: "thunderstorms-rain",
  1279: "thunderstorms-snow",
  1282: "thunderstorms-snow",
};

const WMO_ICONS: Record<number, string> = {
  0: "clear",
  1: "clear",
  2: "partly-cloudy",
  3: "overcast",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "drizzle",
  57: "drizzle",
  61: "partly-cloudy-rain",
  63: "rain",
  65: "rain",
  66: "sleet",
  67: "sleet",
  71: "partly-cloudy-snow",
  73: "snow",
  75: "snow",
  77: "snow",
  80: "partly-cloudy-rain",
  81: "rain",
  82: "rain",
  85: "partly-cloudy-snow",
  86: "snow",
  95: "thunderstorms-rain",
  96: "thunderstorms-rain",
  99: "thunderstorms-rain",
};

/** Shown when a code is outside both tables. Meteocons ships this on purpose. */
const FALLBACK = "not-available";

export function weatherIconName(condition: ConditionRef): string {
  const table =
    condition.system === "weatherapi" ? WEATHER_API_ICONS : WMO_ICONS;
  const base = table[condition.code];

  return base ? variant(base, condition.isDay) : FALLBACK;
}

export function weatherIconSrc(condition: ConditionRef): string {
  return `/weather-icons/${weatherIconName(condition)}.svg`;
}

/**
 * Every file the app can ask for. The sync script copies exactly this set out
 * of the Meteocons package, so the two cannot drift apart.
 */
export function allIconNames(): string[] {
  const names = new Set<string>([FALLBACK]);

  for (const table of [WEATHER_API_ICONS, WMO_ICONS]) {
    for (const base of Object.values(table)) {
      names.add(variant(base, true));
      names.add(variant(base, false));
    }
  }

  return [...names].sort();
}
