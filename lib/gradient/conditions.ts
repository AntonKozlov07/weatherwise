/**
 * The seven gradient buckets.
 *
 * The code-to-bucket table lives in `lib/weather/openweather/conditions.ts`,
 * next to the label and icon for the same code, so one condition cannot be
 * classified two different ways in two places. This module owns the bucket
 * vocabulary and the tuning surface's view of it.
 */

export type ConditionBucket =
  | "clear"
  | "partlyCloudy"
  | "overcast"
  | "rain"
  | "snow"
  | "thunderstorm"
  | "fog";

export const CONDITION_BUCKETS: ConditionBucket[] = [
  "clear",
  "partlyCloudy",
  "overcast",
  "rain",
  "snow",
  "thunderstorm",
  "fog",
];

/** A representative OpenWeatherMap code per bucket, for the tuning page. */
export const SAMPLE_CODE: Record<ConditionBucket, number> = {
  clear: 800,
  partlyCloudy: 802,
  overcast: 804,
  rain: 501,
  snow: 601,
  thunderstorm: 200,
  fog: 741,
};
