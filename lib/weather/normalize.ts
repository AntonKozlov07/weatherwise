import { conditionInfo } from "./openweather/conditions";
import type {
  RawAlertDetail,
  RawCurrentRecord,
  RawDayRecord,
  RawEnvelope,
  RawHourRecord,
  RawMinuteRecord,
  RawWeather,
} from "./openweather/raw";
import type {
  AirQuality,
  Astronomy,
  ConditionRef,
  CurrentConditions,
  DailyPoint,
  HourlyPoint,
  MinutelyPoint,
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
 * sunrise and sunset, which are only present on some endpoints.
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

/** Daily rain and snow are totals; hourly are `{ "1h": mm }` buckets. */
function precipitationMm(
  value: { "1h"?: number } | number | undefined,
): number {
  if (typeof value === "number") return value;
  return value?.["1h"] ?? 0;
}

export function normalizeCurrent(raw: RawCurrentRecord): CurrentConditions {
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
    // The current endpoint carries no rain or snow field at all, unlike hourly.
    precipitation: 0,
    uvIndex: raw.uvi,
    wind: normalizeWind(raw.wind_speed, raw.wind_deg, raw.wind_gust),
  };
}

function normalizeHour(raw: RawHourRecord): HourlyPoint {
  return {
    time: toMillis(raw.dt),
    condition: normalizeCondition(raw.weather),
    temperature: raw.temp,
    feelsLike: raw.feels_like,
    // OWM reports probability as 0 to 1; the app shows a percentage.
    precipitationChance: Math.round((raw.pop ?? 0) * 100),
    precipitation: precipitationMm(raw.rain) + precipitationMm(raw.snow),
    humidity: raw.humidity,
    uvIndex: raw.uvi,
    wind: normalizeWind(raw.wind_speed, raw.wind_deg, raw.wind_gust),
  };
}

/**
 * The timeline already starts at the current hour, so unlike the previous vendor
 * there is nothing in the past to trim. It is still filtered, because a cached
 * payload served offline can be hours old.
 */
export function normalizeHourly(
  envelope: RawEnvelope<RawHourRecord> | null,
  now: number,
): HourlyPoint[] {
  const currentHour = now - (now % 3_600_000);

  return (envelope?.data ?? [])
    .map(normalizeHour)
    .filter((hour) => hour.time >= currentHour)
    .slice(0, HOURLY_POINTS);
}

export function normalizeDaily(
  envelope: RawEnvelope<RawDayRecord> | null,
): DailyPoint[] {
  return (envelope?.data ?? []).map((day) => ({
    date: toMillis(day.dt),
    condition: normalizeCondition(day.weather),
    sunrise: day.sunrise === undefined ? null : toMillis(day.sunrise),
    sunset: day.sunset === undefined ? null : toMillis(day.sunset),
    high: day.temp.max,
    low: day.temp.min,
    precipitationChance: Math.round((day.pop ?? 0) * 100),
    precipitation: precipitationMm(day.rain) + precipitationMm(day.snow),
    humidity: day.humidity,
    uvIndex: day.uvi,
    wind: normalizeWind(day.wind_speed, day.wind_deg, day.wind_gust),
  }));
}

/**
 * Minute-by-minute precipitation. Null propagates: the region has no data and
 * the nowcast card is not rendered at all.
 */
export function normalizeMinutely(
  envelope: RawEnvelope<RawMinuteRecord> | null,
): MinutelyPoint[] | null {
  if (!envelope || envelope.data.length === 0) return null;

  return envelope.data.map((minute) => ({
    time: toMillis(minute.dt),
    precipitation: minute.precipitation ?? 0,
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

/**
 * Sun times sit on both the current record and the daily timeline; moon data
 * only on daily. Current is preferred for the sun because it is the one request
 * that always runs.
 */
export function normalizeAstronomy(
  current: RawCurrentRecord,
  daily: RawEnvelope<RawDayRecord> | null,
): Astronomy {
  const today = daily?.data?.[0];
  const phase = today?.moon_phase;

  return {
    sunrise: toMillisOrNull(current.sunrise ?? today?.sunrise),
    sunset: toMillisOrNull(current.sunset ?? today?.sunset),
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
 * Alerts arrive already resolved from the alert endpoint. 4.0 gives each one a
 * real id, so unlike the previous vendor the dismissal key needs no synthesising.
 */
export function normalizeAlerts(raw: RawAlertDetail[]): WeatherAlert[] {
  return raw
    .filter((alert) => Boolean(alert.event))
    .map((alert) => ({
      id: alert.id ?? `${alert.event}|${alert.start ?? ""}`,
      event: alert.event ?? "Weather alert",
      source: alert.sender_name ?? "",
      description: alert.description ?? "",
      effective: toMillisOrNull(alert.start),
      expires: toMillisOrNull(alert.end),
      // 4.0 dropped the tags field the previous shape carried.
      tags: [],
    }));
}
