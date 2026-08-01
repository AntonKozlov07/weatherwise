import { wmoToOwm } from "@/lib/weather/openmeteo/wmo";
import { conditionInfo } from "@/lib/weather/openweather/conditions";
import { cityCoordinates, WORLD_CITIES, type WorldCity } from "@/lib/world/cities";
import type { ConditionRef } from "@/lib/weather/types";

/**
 * Every world city in one request.
 *
 * Open-Meteo accepts comma-separated coordinates and returns an array in the
 * same order, so eight cities cost one call rather than eight. Nothing here is
 * personal, so the response is cached and shared rather than fetched per device
 * (Decisions Log 102).
 */

const FORECAST_API = "https://api.open-meteo.com/v1/forecast";
/** Ten minutes. A city on the far side of the world is not urgent. */
const REVALIDATE_SECONDS = 600;
const TIMEOUT_MS = 5_000;

export type WorldSnapshot = WorldCity & {
  /** Translated into this app's own condition vocabulary. */
  condition: ConditionRef;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windKph: number;
  precipitation: number;
  /** Local time at the city, "9:41 PM" style, formatted by the client. */
  observedAt: number;
  /** IANA zone, so the card can show the city's own clock. */
  timeZone: string;
};

type RawCity = {
  timezone?: unknown;
  current?: {
    time?: unknown;
    temperature_2m?: unknown;
    apparent_temperature?: unknown;
    relative_humidity_2m?: unknown;
    wind_speed_10m?: unknown;
    precipitation?: unknown;
    weather_code?: unknown;
    is_day?: unknown;
  };
};

function num(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function toSnapshot(city: WorldCity, raw: RawCity): WorldSnapshot | null {
  const current = raw.current;
  if (!current || typeof current.temperature_2m !== "number") return null;

  const owmCode = wmoToOwm(num(current.weather_code, 0));
  const info = conditionInfo(owmCode);

  return {
    ...city,
    condition: {
      code: owmCode,
      label: info.label,
      // Open-Meteo reports day or night directly, which is more reliable than
      // inferring it from a clock and a longitude.
      isDay: num(current.is_day, 1) === 1,
    },
    temperature: num(current.temperature_2m),
    feelsLike: num(current.apparent_temperature, num(current.temperature_2m)),
    humidity: num(current.relative_humidity_2m, 50),
    windKph: num(current.wind_speed_10m),
    precipitation: num(current.precipitation),
    observedAt:
      typeof current.time === "string" ? Date.parse(`${current.time}Z`) : Date.now(),
    timeZone: typeof raw.timezone === "string" ? raw.timezone : "UTC",
  };
}

/**
 * Returns an empty array on any failure.
 *
 * The world board is the least important thing on the screen it appears on, so
 * a fault here shows nothing rather than an error: losing eight distant cities
 * must never be able to take down the history and facts beside them.
 */
export async function fetchWorldWeather(): Promise<WorldSnapshot[]> {
  const { latitudes, longitudes } = cityCoordinates();

  const url =
    `${FORECAST_API}?latitude=${latitudes}&longitude=${longitudes}` +
    "&current=temperature_2m,apparent_temperature,relative_humidity_2m," +
    "wind_speed_10m,precipitation,weather_code,is_day" +
    "&timezone=auto";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) return [];

    const payload = (await response.json()) as RawCity | RawCity[];
    // A single coordinate returns an object rather than an array. Eight never
    // will, but the shape is the vendor's choice and not worth trusting.
    const rows = Array.isArray(payload) ? payload : [payload];

    return WORLD_CITIES.map((city, index) =>
      rows[index] ? toSnapshot(city, rows[index]) : null,
    ).filter((snapshot): snapshot is WorldSnapshot => snapshot !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
