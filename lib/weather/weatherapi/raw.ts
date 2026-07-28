/**
 * WeatherAPI.com response shapes, narrowed to the fields this app reads.
 * Anything not listed here is deliberately ignored rather than typed loosely.
 */

export type RawCondition = {
  text: string;
  icon: string;
  code: number;
};

export type RawLocation = {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  tz_id: string;
  localtime_epoch: number;
};

export type RawAirQuality = {
  co: number;
  no2: number;
  o3: number;
  so2: number;
  pm2_5: number;
  pm10: number;
  "us-epa-index": number;
};

export type RawCurrent = {
  last_updated_epoch: number;
  temp_c: number;
  is_day: 0 | 1;
  condition: RawCondition;
  wind_kph: number;
  wind_degree: number;
  wind_dir: string;
  pressure_mb: number;
  precip_mm: number;
  humidity: number;
  cloud: number;
  feelslike_c: number;
  dewpoint_c: number;
  vis_km: number;
  uv: number;
  gust_kph?: number;
  air_quality?: RawAirQuality;
};

export type RawHour = {
  time_epoch: number;
  temp_c: number;
  is_day: 0 | 1;
  condition: RawCondition;
  wind_kph: number;
  wind_degree: number;
  wind_dir: string;
  precip_mm: number;
  humidity: number;
  feelslike_c: number;
  chance_of_rain: number;
  chance_of_snow: number;
  uv: number;
  gust_kph?: number;
};

export type RawAstro = {
  sunrise: string;
  sunset: string;
  moonrise: string;
  moonset: string;
  moon_phase: string;
  moon_illumination: number | string;
};

export type RawForecastDay = {
  date_epoch: number;
  astro: RawAstro;
  hour: RawHour[];
};

export type RawAlert = {
  headline?: string;
  event?: string;
  severity?: string;
  urgency?: string;
  areas?: string;
  desc?: string;
  instruction?: string;
  effective?: string;
  expires?: string;
};

export type RawForecastResponse = {
  location: RawLocation;
  current: RawCurrent;
  forecast: { forecastday: RawForecastDay[] };
  /** Absent on plans without alerts, and `{ alert: [] }` when there are none. */
  alerts?: { alert?: RawAlert[] };
};

export type RawSearchMatch = {
  id: number;
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
};

/**
 * WeatherAPI answers errors with HTTP 4xx and a body of this shape. The code
 * distinguishes a bad key from a bad query, which map to different statuses.
 */
export type RawErrorResponse = {
  error: { code: number; message: string };
};

export function isForecastResponse(
  value: unknown,
): value is RawForecastResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RawForecastResponse>;

  return (
    typeof candidate.location?.tz_id === "string" &&
    typeof candidate.current?.temp_c === "number" &&
    Array.isArray(candidate.forecast?.forecastday)
  );
}

export function isSearchResponse(value: unknown): value is RawSearchMatch[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as RawSearchMatch).lat === "number" &&
        typeof (entry as RawSearchMatch).lon === "number",
    )
  );
}
