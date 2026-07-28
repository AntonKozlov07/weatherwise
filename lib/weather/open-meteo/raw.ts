/**
 * Open-Meteo response shape for the daily endpoint.
 *
 * Open-Meteo returns columns, not rows: every `daily.*` field is an array
 * indexed in step with `daily.time`. Entries can be null where a variable is
 * unavailable for a day, so the arrays are typed as nullable and zipped in the
 * normaliser.
 */

export type RawDaily = {
  time: number[];
  weather_code: (number | null)[];
  temperature_2m_max: (number | null)[];
  temperature_2m_min: (number | null)[];
  precipitation_probability_max: (number | null)[];
  precipitation_sum: (number | null)[];
  wind_speed_10m_max: (number | null)[];
  wind_gusts_10m_max: (number | null)[];
  wind_direction_10m_dominant: (number | null)[];
  uv_index_max: (number | null)[];
  sunrise: (number | null)[];
  sunset: (number | null)[];
};

export type RawDailyResponse = {
  latitude: number;
  longitude: number;
  timezone: string;
  utc_offset_seconds: number;
  daily: RawDaily;
};

export function isDailyResponse(value: unknown): value is RawDailyResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RawDailyResponse>;

  return (
    typeof candidate.utc_offset_seconds === "number" &&
    Array.isArray(candidate.daily?.time) &&
    Array.isArray(candidate.daily?.temperature_2m_max)
  );
}
