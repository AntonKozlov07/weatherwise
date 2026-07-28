import { wmoText } from "./open-meteo/wmo";
import type { RawDailyResponse } from "./open-meteo/raw";
import type {
  AirQuality,
  Astronomy,
  CurrentConditions,
  DailyPoint,
  HourlyPoint,
  LocationSummary,
  WeatherAlert,
  Wind,
} from "./types";
import type {
  RawAlert,
  RawCurrent,
  RawForecastResponse,
  RawHour,
} from "./weatherapi/raw";

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

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** WeatherAPI epochs are seconds. Everything downstream is milliseconds. */
function toMillis(epochSeconds: number): number {
  return epochSeconds * 1000;
}

function parseIsoOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

export function normalizeLocation(raw: RawForecastResponse): LocationSummary {
  return {
    name: raw.location.name,
    region: raw.location.region,
    country: raw.location.country,
    latitude: raw.location.lat,
    longitude: raw.location.lon,
    timeZone: raw.location.tz_id,
  };
}

function normalizeWind(
  speed: number,
  degrees: number,
  compass: string | null,
  gust: number | null | undefined,
): Wind {
  return {
    speed,
    gust: typeof gust === "number" ? gust : null,
    direction: degrees,
    compass: compass ?? degreesToCompass(degrees),
  };
}

export function normalizeCurrent(raw: RawCurrent): CurrentConditions {
  return {
    observedAt: toMillis(raw.last_updated_epoch),
    condition: {
      system: "weatherapi",
      code: raw.condition.code,
      text: raw.condition.text,
      isDay: raw.is_day === 1,
    },
    temperature: raw.temp_c,
    feelsLike: raw.feelslike_c,
    dewPoint: raw.dewpoint_c,
    humidity: raw.humidity,
    pressure: raw.pressure_mb,
    visibility: raw.vis_km,
    cloudCover: raw.cloud,
    precipitation: raw.precip_mm,
    uvIndex: raw.uv,
    wind: normalizeWind(
      raw.wind_kph,
      raw.wind_degree,
      raw.wind_dir,
      raw.gust_kph,
    ),
  };
}

function normalizeHour(raw: RawHour): HourlyPoint {
  return {
    time: toMillis(raw.time_epoch),
    condition: {
      system: "weatherapi",
      code: raw.condition.code,
      text: raw.condition.text,
      isDay: raw.is_day === 1,
    },
    temperature: raw.temp_c,
    feelsLike: raw.feelslike_c,
    // Rain and snow are reported separately; the card shows one number.
    precipitationChance: Math.max(raw.chance_of_rain, raw.chance_of_snow),
    precipitation: raw.precip_mm,
    humidity: raw.humidity,
    uvIndex: raw.uv,
    wind: normalizeWind(
      raw.wind_kph,
      raw.wind_degree,
      raw.wind_dir,
      raw.gust_kph,
    ),
  };
}

/**
 * WeatherAPI returns whole days, so the first day starts at midnight and is
 * mostly in the past by evening. The rail wants the hours ahead, so trim to the
 * current hour onward.
 */
export function normalizeHourly(
  raw: RawForecastResponse,
  now: number,
): HourlyPoint[] {
  const currentHour = now - (now % 3_600_000);

  return raw.forecast.forecastday
    .flatMap((day) => day.hour)
    .map(normalizeHour)
    .filter((hour) => hour.time >= currentHour)
    .slice(0, HOURLY_POINTS);
}

/**
 * Sunrise and sunset come from Open-Meteo as real instants; moon data comes
 * from WeatherAPI as local wall clock strings, which are display only
 * (Decisions Log 19).
 */
export function normalizeAstronomy(
  forecast: RawForecastResponse,
  daily: RawDailyResponse | null,
): Astronomy {
  const astro = forecast.forecast.forecastday[0]?.astro;
  const sunrise = daily?.daily.sunrise[0] ?? null;
  const sunset = daily?.daily.sunset[0] ?? null;

  return {
    sunrise: sunrise === null ? null : toMillis(sunrise),
    sunset: sunset === null ? null : toMillis(sunset),
    moonrise: astro?.moonrise ?? null,
    moonset: astro?.moonset ?? null,
    moonPhase: astro?.moon_phase ?? null,
    moonIllumination: toNumber(astro?.moon_illumination),
  };
}

export function normalizeAirQuality(raw: RawCurrent): AirQuality | null {
  const aq = raw.air_quality;
  if (!aq) return null;

  return {
    epaIndex: aq["us-epa-index"],
    pm2_5: aq.pm2_5,
    pm10: aq.pm10,
    ozone: aq.o3,
    nitrogenDioxide: aq.no2,
    sulphurDioxide: aq.so2,
    carbonMonoxide: aq.co,
  };
}

/**
 * WeatherAPI alerts carry no identifier. The banner is dismissible and the
 * dismissal has to survive a refetch, so the key is built from the fields that
 * identify the alert rather than its position in the array.
 */
function alertId(raw: RawAlert): string {
  return [raw.event ?? "", raw.effective ?? "", raw.areas ?? ""].join("|");
}

export function normalizeAlerts(raw: RawForecastResponse): WeatherAlert[] {
  const alerts = raw.alerts?.alert ?? [];

  return alerts
    .filter((alert) => Boolean(alert.event ?? alert.headline))
    .map((alert) => ({
      id: alertId(alert),
      event: alert.event ?? "Weather alert",
      headline: alert.headline ?? alert.event ?? "Weather alert",
      severity: alert.severity ?? "Unknown",
      urgency: alert.urgency ?? "Unknown",
      areas: alert.areas ?? "",
      description: alert.desc ?? "",
      instruction: alert.instruction ?? null,
      effective: parseIsoOrNull(alert.effective),
      expires: parseIsoOrNull(alert.expires),
    }));
}

export function normalizeDaily(raw: RawDailyResponse): DailyPoint[] {
  const daily = raw.daily;

  return daily.time.map((time, index) => {
    const code = daily.weather_code[index] ?? null;
    const direction = daily.wind_direction_10m_dominant[index] ?? 0;

    return {
      date: toMillis(time),
      condition: {
        system: "wmo",
        code: code ?? -1,
        text: wmoText(code),
        // A daily summary has no time of day. Day icons are the sane default.
        isDay: true,
      },
      high: daily.temperature_2m_max[index] ?? 0,
      low: daily.temperature_2m_min[index] ?? 0,
      precipitationChance: daily.precipitation_probability_max[index] ?? 0,
      precipitation: daily.precipitation_sum[index] ?? 0,
      uvIndex: daily.uv_index_max[index] ?? 0,
      wind: normalizeWind(
        daily.wind_speed_10m_max[index] ?? 0,
        direction,
        null,
        daily.wind_gusts_10m_max[index] ?? null,
      ),
    };
  });
}
