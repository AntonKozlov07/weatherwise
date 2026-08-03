import { wmoToOwm } from "@/lib/weather/openmeteo/wmo";
import { conditionLabelFor } from "@/lib/weather/openweather/conditions";
import { cityCoordinates, WORLD_CITIES, type WorldCity } from "@/lib/world/cities";

/** Marks the user's own location among the ranked cities. */
export const HOME_CITY_ID = "__home__";
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
  utc_offset_seconds?: unknown;
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
  // Open-Meteo reports day or night directly, which is more reliable than
  // inferring it from a clock and a longitude.
  const isDay = num(current.is_day, 1) === 1;

  return {
    ...city,
    condition: { code: owmCode, label: conditionLabelFor(owmCode, isDay), isDay },
    temperature: num(current.temperature_2m),
    feelsLike: num(current.apparent_temperature, num(current.temperature_2m)),
    humidity: num(current.relative_humidity_2m, 50),
    windKph: num(current.wind_speed_10m),
    precipitation: num(current.precipitation),
    /*
      Open-Meteo returns a local wall clock under `timezone=auto`, with no
      offset on it: "2026-08-01T08:00" is eight in the morning in Tokyo, not in
      UTC. Parsing it with a Z appended gives an instant that is wrong by the
      city's offset, and formatting that instant back into the city's zone
      shifts it a second time. Tokyo read 5pm when it was 8am.

      The offset the response carries alongside it is what makes the instant
      real (Decisions Log 108).
    */
    observedAt:
      typeof current.time === "string"
        ? Date.parse(`${current.time}Z`) - num(raw.utc_offset_seconds) * 1000
        : Date.now(),
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
export async function fetchWorldWeather(
  /**
   * The user's own location, ranked alongside the rest. Fetched in the same
   * request from the same vendor: comparing an OpenWeatherMap reading for home
   * against Open-Meteo readings for everywhere else would put a vendor
   * difference into the standings and call it weather (Decisions Log 113).
   */
  home?: { name: string; latitude: number; longitude: number } | null,
): Promise<WorldSnapshot[]> {
  const base = cityCoordinates();

  const cities: WorldCity[] = home
    ? [
        ...WORLD_CITIES,
        {
          id: HOME_CITY_ID,
          name: home.name,
          country: "",
          latitude: home.latitude,
          longitude: home.longitude,
          // Yours is never drawn as a climate card, only ranked, so the tag is
          // a placeholder rather than a claim about where you live.
          climate: "temperate" as const,
        },
      ]
    : WORLD_CITIES;

  const latitudes = home ? `${base.latitudes},${home.latitude}` : base.latitudes;
  const longitudes = home ? `${base.longitudes},${home.longitude}` : base.longitudes;

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

    return cities.map((city, index) =>
      rows[index] ? toSnapshot(city, rows[index]) : null,
    ).filter((snapshot): snapshot is WorldSnapshot => snapshot !== null);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
