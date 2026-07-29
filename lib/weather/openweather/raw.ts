/**
 * OpenWeatherMap One Call response shapes, narrowed to the fields this app uses.
 *
 * Structure is the same across One Call versions (current, minutely, hourly,
 * daily, alerts blocks); only the path version differs. `isOneCallResponse`
 * below is what actually confirms the shape at runtime, so a version that
 * answers differently fails loudly instead of rendering blanks.
 *
 * Units are requested as `metric`, so temperatures are Celsius and wind is m/s.
 * Wind needs converting to km/h; OWM does not offer km/h directly.
 */

export type RawWeather = {
  id: number;
  main: string;
  description: string;
  icon: string;
};

export type RawCurrent = {
  dt: number;
  sunrise?: number;
  sunset?: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  visibility?: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust?: number;
  weather: RawWeather[];
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
};

export type RawHour = {
  dt: number;
  temp: number;
  feels_like: number;
  pressure: number;
  humidity: number;
  dew_point: number;
  uvi: number;
  clouds: number;
  visibility?: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust?: number;
  weather: RawWeather[];
  /** Probability of precipitation, 0 to 1. */
  pop: number;
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
};

export type RawDay = {
  dt: number;
  sunrise?: number;
  sunset?: number;
  moonrise?: number;
  moonset?: number;
  /** 0 and 1 are new moon, 0.5 is full. Not an illumination percentage. */
  moon_phase?: number;
  summary?: string;
  temp: {
    day: number;
    min: number;
    max: number;
    night: number;
    eve: number;
    morn: number;
  };
  feels_like: { day: number; night: number; eve: number; morn: number };
  pressure: number;
  humidity: number;
  dew_point: number;
  wind_speed: number;
  wind_deg: number;
  wind_gust?: number;
  weather: RawWeather[];
  clouds: number;
  pop: number;
  rain?: number;
  snow?: number;
  uvi: number;
};

export type RawAlert = {
  sender_name?: string;
  event?: string;
  start?: number;
  end?: number;
  description?: string;
  tags?: string[];
};

export type RawOneCallResponse = {
  lat: number;
  lon: number;
  /** IANA zone, e.g. "America/Toronto". */
  timezone: string;
  timezone_offset: number;
  current: RawCurrent;
  hourly?: RawHour[];
  daily?: RawDay[];
  alerts?: RawAlert[];
};

export function isOneCallResponse(value: unknown): value is RawOneCallResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RawOneCallResponse>;

  return (
    typeof candidate.timezone === "string" &&
    typeof candidate.timezone_offset === "number" &&
    typeof candidate.current?.temp === "number" &&
    Array.isArray(candidate.current?.weather)
  );
}

/** Geocoding API entry, used for city search and for place names. */
export type RawGeocodeMatch = {
  name: string;
  lat: number;
  lon: number;
  country?: string;
  state?: string;
};

export function isGeocodeResponse(value: unknown): value is RawGeocodeMatch[] {
  return (
    Array.isArray(value) &&
    value.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as RawGeocodeMatch).lat === "number" &&
        typeof (entry as RawGeocodeMatch).lon === "number" &&
        typeof (entry as RawGeocodeMatch).name === "string",
    )
  );
}

/** Air Pollution API, a separate endpoint. One Call carries no air quality. */
export type RawAirPollution = {
  list?: {
    main?: { aqi?: number };
    components?: Record<string, number>;
  }[];
};
