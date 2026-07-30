/**
 * OpenWeatherMap One Call API 4.0 response shapes, narrowed to what this app uses.
 *
 * 4.0 is not 3.0 with a version bump. It splits the forecast across endpoints
 * and wraps every payload in the same envelope:
 *
 *   /data/4.0/onecall/current        -> data[0] is now
 *   /data/4.0/onecall/timeline/1h    -> data[] is hourly
 *   /data/4.0/onecall/timeline/1day  -> data[] is daily
 *   /data/4.0/onecall/alert/{id}     -> one alert, by id
 *
 * There is no combined call, so current, hourly and daily are three requests.
 * Alerts arrive as bare ids on the weather records and need a further request
 * each to resolve (Decisions Log 46).
 *
 * Units are requested as `metric`, so temperatures are Celsius and wind is m/s.
 * Wind needs converting to km/h; OWM offers no km/h option.
 */

export type RawWeather = {
  id: number;
  main: string;
  description: string;
  icon: string;
};

/** Fields shared by every record, whatever the endpoint. */
type RawRecordBase = {
  dt: number;
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
  /** Alert ids in effect, resolved separately. */
  alerts?: string[];
};

export type RawCurrentRecord = RawRecordBase & {
  temp: number;
  feels_like: number;
  sunrise?: number;
  sunset?: number;
};

export type RawHourRecord = RawRecordBase & {
  temp: number;
  feels_like: number;
  /** Probability of precipitation, 0 to 1. */
  pop: number;
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
};

export type RawDayRecord = RawRecordBase & {
  /** Daily temperature is an object here, unlike current and hourly. */
  temp: {
    day: number;
    min: number;
    max: number;
    night: number;
    eve: number;
    morn: number;
  };
  feels_like: { day: number; night: number; eve: number; morn: number };
  pop: number;
  rain?: { "1h"?: number } | number;
  snow?: { "1h"?: number } | number;
  sunrise?: number;
  sunset?: number;
  moonrise?: number;
  moonset?: number;
  /** 0 and 1 are new moon, 0.5 is full. Not an illumination percentage. */
  moon_phase?: number;
};

/** The envelope every 4.0 endpoint returns. */
export type RawEnvelope<T> = {
  lat: number;
  lon: number;
  /** IANA zone, e.g. "America/Toronto". */
  timezone: string;
  timezone_offset: number;
  data: T[];
  /** Timeline pagination. Unused: the first page covers the app's window. */
  prev?: string;
  next?: string;
};

function isEnvelope(value: unknown): value is RawEnvelope<unknown> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<RawEnvelope<unknown>>;

  return (
    typeof candidate.timezone === "string" &&
    typeof candidate.timezone_offset === "number" &&
    Array.isArray(candidate.data)
  );
}

/**
 * The shape guard is what turns a wrong endpoint or a version mismatch into a
 * clear error rather than a screen of blanks, so it checks a real field on the
 * first record and not just the envelope.
 */
export function isCurrentResponse(
  value: unknown,
): value is RawEnvelope<RawCurrentRecord> {
  if (!isEnvelope(value)) return false;
  const first = value.data[0] as Partial<RawCurrentRecord> | undefined;

  return typeof first?.temp === "number" && Array.isArray(first?.weather);
}

export function isHourlyResponse(
  value: unknown,
): value is RawEnvelope<RawHourRecord> {
  if (!isEnvelope(value)) return false;
  if (value.data.length === 0) return true;

  const first = value.data[0] as Partial<RawHourRecord>;
  return typeof first.temp === "number";
}

export function isDailyResponse(
  value: unknown,
): value is RawEnvelope<RawDayRecord> {
  if (!isEnvelope(value)) return false;
  if (value.data.length === 0) return true;

  const first = value.data[0] as Partial<RawDayRecord>;
  return typeof first.temp === "object" && first.temp !== null;
}

/** Resolved from /onecall/alert/{id}. Carries no severity, urgency or areas. */
export type RawAlertDetail = {
  id?: string;
  sender_name?: string;
  event?: string;
  start?: number;
  end?: number;
  description?: string;
};

export function isAlertDetail(value: unknown): value is RawAlertDetail {
  return typeof value === "object" && value !== null;
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
