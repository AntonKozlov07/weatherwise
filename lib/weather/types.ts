/**
 * Domain types returned by the route handlers. These are the only weather
 * shapes the app renders; vendor payload shapes stay behind the clients.
 *
 * Everything here is metric and canonical: Celsius, km/h, mm, km, hPa. The
 * units toggle is a formatting concern on the client, so switching it must not
 * cost a network round trip (Decisions Log 8 and 18).
 *
 * Every instant is epoch milliseconds. Local wall clock rendering uses
 * `location.timeZone`.
 */

/**
 * A condition as the source reported it. WeatherAPI and Open-Meteo use
 * different code vocabularies, so the system travels with the code and callers
 * map it: phase 3 maps to gradient buckets, phase 4 to Meteocons.
 */
export type ConditionRef = {
  system: "weatherapi" | "wmo";
  code: number;
  text: string;
  isDay: boolean;
};

export type LocationSummary = {
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  /** IANA zone, e.g. "America/Toronto". */
  timeZone: string;
};

export type Wind = {
  /** km/h */
  speed: number;
  /** km/h, null when the source did not report gusts. */
  gust: number | null;
  /** Degrees clockwise from north. */
  direction: number;
  /** Compass abbreviation, e.g. "NNW". */
  compass: string;
};

export type CurrentConditions = {
  /** When the vendor last refreshed this reading, not when we fetched it. */
  observedAt: number;
  condition: ConditionRef;
  /** Celsius */
  temperature: number;
  /** Celsius */
  feelsLike: number;
  /** Celsius */
  dewPoint: number;
  /** Percent */
  humidity: number;
  /** hPa */
  pressure: number;
  /** km */
  visibility: number;
  /** Percent */
  cloudCover: number;
  /** mm in the last hour */
  precipitation: number;
  uvIndex: number;
  wind: Wind;
};

export type HourlyPoint = {
  time: number;
  condition: ConditionRef;
  /** Celsius */
  temperature: number;
  /** Celsius */
  feelsLike: number;
  /** Percent */
  precipitationChance: number;
  /** mm */
  precipitation: number;
  /** Percent */
  humidity: number;
  uvIndex: number;
  wind: Wind;
};

export type DailyPoint = {
  /** Local midnight for the day. */
  date: number;
  condition: ConditionRef;
  /** Celsius */
  high: number;
  /** Celsius */
  low: number;
  /** Percent */
  precipitationChance: number;
  /** mm */
  precipitation: number;
  uvIndex: number;
  wind: Wind;
};

export type Astronomy = {
  /**
   * Epoch milliseconds, from Open-Meteo. The gradient anchors to these, so they
   * have to be real instants rather than the "07:12 AM" strings WeatherAPI
   * returns without an offset (Decisions Log 19).
   */
  sunrise: number | null;
  sunset: number | null;
  /** Local wall clock strings from WeatherAPI, for display only. */
  moonrise: string | null;
  moonset: string | null;
  moonPhase: string | null;
  /** Percent */
  moonIllumination: number | null;
};

export type AirQuality = {
  /** US EPA index, 1 to 6. */
  epaIndex: number;
  /** Micrograms per cubic metre. */
  pm2_5: number;
  pm10: number;
  ozone: number;
  nitrogenDioxide: number;
  sulphurDioxide: number;
  carbonMonoxide: number;
};

export type WeatherAlert = {
  /** Stable enough to key a dismissal against. */
  id: string;
  event: string;
  headline: string;
  severity: string;
  urgency: string;
  areas: string;
  description: string;
  instruction: string | null;
  effective: number | null;
  expires: number | null;
};

export type SourceStatus =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * The whole payload the home screen needs. Daily can come back empty with
 * `sources.openMeteo.ok === false`: current conditions are still worth showing
 * when only the daily forecast failed.
 */
export type ForecastBundle = {
  location: LocationSummary;
  current: CurrentConditions;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  astronomy: Astronomy;
  airQuality: AirQuality | null;
  alerts: WeatherAlert[];
  sources: { weatherapi: SourceStatus; openMeteo: SourceStatus };
  /** When this response was assembled, for "updated Nm ago". */
  fetchedAt: number;
};

export type CityMatch = {
  id: number;
  name: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
};
