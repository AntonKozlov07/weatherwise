import type { ConditionBucket } from "@/lib/gradient/conditions";

/**
 * OpenWeatherMap condition codes to everything the app needs from them.
 *
 * OWM sends a numeric `weather[].id` plus a lowercase `description`. The
 * description is not usable as-is ("broken clouds", "moderate rain"), so the
 * label comes from here instead. One table, so a code cannot pick up a label in
 * one place and a different icon in another.
 *
 * `bucket` drives the greeting gradient, `icon` is a Meteocons base name, and
 * `label` is what the user reads.
 *
 * Codes are grouped by OWM's own hundreds ranges: 2xx thunderstorm, 3xx
 * drizzle, 5xx rain, 6xx snow, 7xx atmosphere, 800 clear, 80x clouds.
 */

export type ConditionInfo = {
  label: string;
  bucket: ConditionBucket;
  /** Meteocons base name; day and night variants resolved by the icon module. */
  icon: string;
};

const CONDITIONS: Record<number, ConditionInfo> = {
  // Thunderstorm
  200: { label: "Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms-rain" },
  201: { label: "Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms-rain" },
  202: { label: "Heavy Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms-rain" },
  210: { label: "Light Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms" },
  211: { label: "Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms" },
  212: { label: "Heavy Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms" },
  221: { label: "Ragged Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms" },
  230: { label: "Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms-rain" },
  231: { label: "Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms-rain" },
  232: { label: "Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms-rain" },

  // Drizzle
  300: { label: "Light Drizzle", bucket: "rain", icon: "drizzle" },
  301: { label: "Drizzle", bucket: "rain", icon: "drizzle" },
  302: { label: "Heavy Drizzle", bucket: "rain", icon: "drizzle" },
  310: { label: "Light Drizzle", bucket: "rain", icon: "drizzle" },
  311: { label: "Drizzle", bucket: "rain", icon: "drizzle" },
  312: { label: "Heavy Drizzle", bucket: "rain", icon: "drizzle" },
  313: { label: "Drizzle Showers", bucket: "rain", icon: "drizzle" },
  314: { label: "Heavy Drizzle", bucket: "rain", icon: "drizzle" },
  321: { label: "Drizzle Showers", bucket: "rain", icon: "drizzle" },

  // Rain
  500: { label: "Light Rain", bucket: "rain", icon: "partly-cloudy-rain" },
  501: { label: "Rain", bucket: "rain", icon: "rain" },
  502: { label: "Heavy Rain", bucket: "rain", icon: "rain" },
  503: { label: "Very Heavy Rain", bucket: "rain", icon: "rain" },
  504: { label: "Extreme Rain", bucket: "rain", icon: "rain" },
  511: { label: "Freezing Rain", bucket: "snow", icon: "sleet" },
  520: { label: "Light Showers", bucket: "rain", icon: "partly-cloudy-rain" },
  521: { label: "Showers", bucket: "rain", icon: "rain" },
  522: { label: "Heavy Showers", bucket: "rain", icon: "rain" },
  531: { label: "Ragged Showers", bucket: "rain", icon: "rain" },

  // Snow
  600: { label: "Light Snow", bucket: "snow", icon: "partly-cloudy-snow" },
  601: { label: "Snow", bucket: "snow", icon: "snow" },
  602: { label: "Heavy Snow", bucket: "snow", icon: "snow" },
  611: { label: "Sleet", bucket: "snow", icon: "sleet" },
  612: { label: "Light Sleet", bucket: "snow", icon: "sleet" },
  613: { label: "Sleet Showers", bucket: "snow", icon: "sleet" },
  615: { label: "Rain and Snow", bucket: "snow", icon: "sleet" },
  616: { label: "Rain and Snow", bucket: "snow", icon: "sleet" },
  620: { label: "Light Snow Showers", bucket: "snow", icon: "partly-cloudy-snow" },
  621: { label: "Snow Showers", bucket: "snow", icon: "snow" },
  622: { label: "Heavy Snow Showers", bucket: "snow", icon: "snow" },

  // Atmosphere
  701: { label: "Mist", bucket: "fog", icon: "mist" },
  711: { label: "Smoke", bucket: "fog", icon: "smoke" },
  721: { label: "Haze", bucket: "fog", icon: "haze" },
  731: { label: "Dust", bucket: "fog", icon: "dust" },
  741: { label: "Fog", bucket: "fog", icon: "fog" },
  751: { label: "Sand", bucket: "fog", icon: "dust" },
  761: { label: "Dust", bucket: "fog", icon: "dust" },
  762: { label: "Volcanic Ash", bucket: "fog", icon: "dust" },
  771: { label: "Squalls", bucket: "overcast", icon: "wind" },
  781: { label: "Tornado", bucket: "thunderstorm", icon: "tornado" },

  // Clear and clouds
  800: { label: "Clear", bucket: "clear", icon: "clear" },
  801: { label: "Mostly Sunny", bucket: "partlyCloudy", icon: "partly-cloudy" },
  802: { label: "Partly Cloudy", bucket: "partlyCloudy", icon: "partly-cloudy" },
  803: { label: "Mostly Cloudy", bucket: "overcast", icon: "cloudy" },
  804: { label: "Overcast", bucket: "overcast", icon: "overcast" },
};

/**
 * Falls back by hundreds group, then to clear.
 *
 * A code OWM adds later still lands in the right family rather than reading as
 * "Unknown", and an unrecognised group leaves the gradient showing time of day
 * undiluted, which is the honest failure.
 */
const GROUP_FALLBACK: Record<number, ConditionInfo> = {
  2: { label: "Thunderstorm", bucket: "thunderstorm", icon: "thunderstorms" },
  3: { label: "Drizzle", bucket: "rain", icon: "drizzle" },
  5: { label: "Rain", bucket: "rain", icon: "rain" },
  6: { label: "Snow", bucket: "snow", icon: "snow" },
  7: { label: "Fog", bucket: "fog", icon: "fog" },
  8: { label: "Cloudy", bucket: "overcast", icon: "cloudy" },
};

const UNKNOWN: ConditionInfo = {
  label: "Clear",
  bucket: "clear",
  icon: "clear",
};

export function conditionInfo(code: number): ConditionInfo {
  return (
    CONDITIONS[code] ?? GROUP_FALLBACK[Math.floor(code / 100)] ?? UNKNOWN
  );
}

/** The label shown wherever a condition string is displayed. */
export function conditionLabel(code: number): string {
  return conditionInfo(code).label;
}

/** Exposed for tests, so the table cannot drift from the icon set on disk. */
export const ALL_CONDITION_CODES = Object.keys(CONDITIONS).map(Number);
