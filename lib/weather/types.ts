/**
 * Domain types returned by the route handlers. These are the only weather
 * shapes the app renders; vendor payload shapes stay behind the client.
 *
 * Everything here is metric and canonical: Celsius, km/h, mm, km, hPa. The
 * units toggle is a formatting concern on the client, so switching it must not
 * cost a network round trip (Decisions Log 8 and 18).
 *
 * Every instant is epoch milliseconds. Local wall clock rendering uses
 * `location.timeZone`.
 */

/**
 * A condition as OpenWeatherMap reported it.
 *
 * `code` is OWM's numeric `weather[].id`. The label comes from
 * `lib/weather/openweather/conditions.ts`, not from the vendor's lowercase
 * description, and travels with the code so a card does not have to look it up
 * again (Decisions Log 41).
 */
export type ConditionRef = {
  code: number;
  label: string;
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
  /** km/h, converted from the m/s OWM reports. */
  speed: number;
  /** km/h, null when the source did not report gusts. */
  gust: number | null;
  /** Degrees clockwise from north. */
  direction: number;
  /** Compass abbreviation, derived from the degrees. */
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
  /** Percent, converted from OWM's 0 to 1 probability. */
  precipitationChance: number;
  /** mm */
  precipitation: number;
  /** Percent */
  humidity: number;
  uvIndex: number;
  wind: Wind;
};

export type DailyPoint = {
  /** Local midday for the day, as OWM stamps it. */
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
  /** Percent */
  humidity: number;
  uvIndex: number;
  wind: Wind;
};

export type Astronomy = {
  /** Epoch milliseconds. The gradient anchors to these. */
  sunrise: number | null;
  sunset: number | null;
  /** Epoch milliseconds, formatted for display in the location's zone. */
  moonrise: number | null;
  moonset: number | null;
  /**
   * OWM reports a 0 to 1 cycle position, where 0 and 1 are new and 0.5 is full.
   * There is no illumination percentage, unlike the previous vendor
   * (Decisions Log 42), so `moonPhaseLabel` is derived from this instead.
   */
  moonPhase: number | null;
  moonPhaseLabel: string | null;
};

export type AirQuality = {
  /**
   * OWM's air quality index, 1 (Good) to 5 (Very Poor). Not the 1 to 6 US EPA
   * scale the previous vendor used, and not the 0 to 500 AQI number
   * (Decisions Log 42).
   */
  index: number;
  /** Micrograms per cubic metre, as OWM reports them. */
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
  /** OWM has no separate headline, so this is the issuing office. */
  source: string;
  description: string;
  effective: number | null;
  expires: number | null;
  /** OWM's own categorisation. It carries no severity or urgency field. */
  tags: string[];
};

/**
 * The whole payload the home screen needs, from one vendor.
 *
 * `airQuality` and the resolved place name come from separate OWM endpoints and
 * are allowed to be absent: neither is worth failing a forecast over.
 */
export type ForecastBundle = {
  location: LocationSummary;
  current: CurrentConditions;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  astronomy: Astronomy;
  airQuality: AirQuality | null;
  alerts: WeatherAlert[];
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
