import { conditionInfo } from "./openweather/conditions";
import type {
  RawAlert,
  RawCurrent,
  RawDay,
  RawHour,
  RawOneCallResponse,
  RawWeather,
} from "./openweather/raw";
import type {
  AirQuality,
  Astronomy,
  ConditionRef,
  CurrentConditions,
  DailyPoint,
  HourlyPoint,
  WeatherAlert,
  Wind,
} from "./types";

/** How many hourly points the bundle carries. The rail shows the first 24. */
const HOURLY_POINTS = 48;

const COMPASS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
] as const;

export function degreesToCompass(degrees: number): string {
  const index = Math.round(((degrees % 360) + 360) % 360 / 22.5) % 16;
  return COMPASS[index];
}

/** OWM epochs are seconds. Everything downstream is milliseconds. */
function toMillis(epochSeconds: number): number {
  return epochSeconds * 1000;
}

function toMillisOrNull(epochSeconds: number | undefined): number | null {
  return typeof epochSeconds === "number" ? toMillis(epochSeconds) : null;
}

/** OWM reports wind in m/s under `units=metric`. It offers no km/h option. */
export function metresPerSecondToKph(value: number): number {
  return value * 3.6;
}

function normalizeWind(
  speed: number,
  degrees: number,
  gust: number | undefined,
): Wind {
  return {
    speed: metresPerSecondToKph(speed),
    gust: typeof gust === "number" ? metresPerSecondToKph(gust) : null,
    direction: degrees,
    compass: degreesToCompass(degrees),
  };
}

/**
 * Day or night comes from the icon suffix, `01d` against `01n`.
 *
 * OWM has no `is_day` field, and this is more reliable than comparing against
 * sunrise and sunset, which are only present on some blocks (Decisions Log 42).
 */
function normalizeCondition(weather: RawWeather[] | undefined): ConditionRef {
  const entry = weather?.[0];
  const code = entry?.id ?? 800;

  return {
    code,
    label: conditionInfo(code).label,
    isDay: entry?.icon ? entry.icon.endsWith("d") : true,
  };
}

/** OWM omits `visibility` rather than sending a value when it is unknown. */
function visibilityKm(metres: number | undefined): number {
  return typeof metres === "number" ? metres / 1000 : 0;
}

export function normalizeCurrent(raw: RawCurrent): CurrentConditions {
  return {
    observedAt: toMillis(raw.dt),
    condition: normalizeCondition(raw.weather),
    temperature: raw.temp,
    feelsLike: raw.feels_like,
    dewPoint: raw.dew_point,
    humidity: raw.humidity,
    pressure: raw.pressure,
    visibility: visibilityKm(raw.visibility),
    cloudCover: raw.clouds,
    // Rain and snow are reported separately and only when falling.
    precipitation: (raw.rain?.["1h"] ?? 0) + (raw.snow?.["1h"] ?? 0),
    uvIndex: raw.uvi,
    wind: normalizeWind(raw.wind_speed, raw.wind_deg, raw.wind_gust),
  };
}

function normalizeHour(raw: RawHour): HourlyPoint {
  return {
    time: toMillis(raw.dt),
    condition: normalizeCondition(raw.weather),
    temperature: raw.temp,
    feelsLike: raw.feels_like,
    // OWM reports probability as 0 to 1; the app shows a percentage.
    precipitationChance: Math.round(raw.pop * 100),
    precipitation: (raw.rain?.["1h"] ?? 0) + (raw.snow?.["1h"] ?? 0),
    humidity: raw.humidity,
    uvIndex: raw.uvi,
    wind: normalizeWind(raw.wind_speed, raw.wind_deg, raw.wind_gust),
  };
}

/**
 * OWM's hourly block already starts at the current hour, so unlike the previous
 * vendor there is nothing in the past to trim. It is still filtered, because a
 * cached payload served offline can be hours old.
 */
export function normalizeHourly(
  raw: RawOneCallResponse,
  now: number,
): HourlyPoint[] {
  const currentHour = now - (now % 3_600_000);

  return (raw.hourly ?? [])
    .map(normalizeHour)
    .filter((hour) => hour.time >= currentHour)
    .slice(0, HOURLY_POINTS);
}

export function normalizeDaily(raw: RawOneCallResponse): DailyPoint[] {
  return (raw.daily ?? []).map((day: RawDay) => ({
    date: toMillis(day.dt),
    condition: normalizeCondition(day.weather),
    high: day.temp.max,
    low: day.temp.min,
    precipitationChance: Math.round(day.pop * 100),
    // Daily rain and snow are already totals in mm, not hourly buckets.
    precipitation: (day.rain ?? 0) + (day.snow ?? 0),
    humidity: day.humidity,
    uvIndex: day.uvi,
    wind: normalizeWind(day.wind_speed, day.wind_deg, day.wind_gust),
  }));
}

/**
 * OWM gives a 0 to 1 cycle position rather than a phase name or an illumination
 * percentage, so the label is derived. Boundaries are the conventional eighths,
 * with the quarters and syzygies given a narrow window so "Full Moon" means
 * close to full rather than anything in the second quarter.
 */
export function moonPhaseLabel(phase: number): string {
  if (phase <= 0.02 || phase >= 0.98) return "New Moon";
  if (phase < 0.23) return "Waxing Crescent";
  if (phase <= 0.27) return "First Quarter";
  if (phase < 0.48) return "Waxing Gibbous";
  if (phase <= 0.52) return "Full Moon";
  if (phase < 0.73) return "Waning Gibbous";
  if (phase <= 0.77) return "Last Quarter";
  return "Waning Crescent";
}

export function normalizeAstronomy(raw: RawOneCallResponse): Astronomy {
  const today = raw.daily?.[0];

  // Sun times sit on both blocks; current is preferred because it is always
  // present, while the daily block can be excluded.
  const sunrise = raw.current.sunrise ?? today?.sunrise;
  const sunset = raw.current.sunset ?? today?.sunset;
  const phase = today?.moon_phase;

  return {
    sunrise: toMillisOrNull(sunrise),
    sunset: toMillisOrNull(sunset),
    moonrise: toMillisOrNull(today?.moonrise),
    moonset: toMillisOrNull(today?.moonset),
    moonPhase: typeof phase === "number" ? phase : null,
    moonPhaseLabel: typeof phase === "number" ? moonPhaseLabel(phase) : null,
  };
}

export function normalizeAirQuality(
  raw: { aqi: number; components: Record<string, number> } | null,
): AirQuality | null {
  if (!raw) return null;

  return {
    index: raw.aqi,
    pm2_5: raw.components.pm2_5 ?? 0,
    pm10: raw.components.pm10 ?? 0,
    ozone: raw.components.o3 ?? 0,
    nitrogenDioxide: raw.components.no2 ?? 0,
    sulphurDioxide: raw.components.so2 ?? 0,
    carbonMonoxide: raw.components.co ?? 0,
  };
}

/**
 * OWM alerts carry no identifier. The banner is dismissible and the dismissal
 * has to survive a refetch, so the key is built from the fields that identify
 * the alert rather than its position in the array.
 */
function alertId(raw: RawAlert): string {
  return [raw.event ?? "", raw.start ?? "", raw.sender_name ?? ""].join("|");
}

export function normalizeAlerts(raw: RawOneCallResponse): WeatherAlert[] {
  return (raw.alerts ?? [])
    .filter((alert) => Boolean(alert.event))
    .map((alert) => ({
      id: alertId(alert),
      event: alert.event ?? "Weather alert",
      source: alert.sender_name ?? "",
      description: alert.description ?? "",
      effective: toMillisOrNull(alert.start),
      expires: toMillisOrNull(alert.end),
      tags: alert.tags ?? [],
    }));
}
