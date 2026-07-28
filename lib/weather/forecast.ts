import type { Coordinates } from "./coordinates";
import { WeatherError } from "./errors";
import {
  normalizeAirQuality,
  normalizeAlerts,
  normalizeAstronomy,
  normalizeCurrent,
  normalizeDaily,
  normalizeHourly,
  normalizeLocation,
} from "./normalize";
import { fetchDailyForecast } from "./open-meteo/client";
import type { ForecastBundle, SourceStatus } from "./types";
import { fetchForecast } from "./weatherapi/client";

function reasonFor(error: unknown): string {
  return error instanceof WeatherError
    ? error.message
    : "Could not load the daily forecast.";
}

/**
 * Fetches both sources concurrently and merges them.
 *
 * The two failures are not equivalent. Without WeatherAPI there is no current
 * card and nothing worth rendering, so that propagates. Without Open-Meteo the
 * Weekly rail is empty but everything else still works, so that degrades: the
 * caller gets a 200 with `sources.openMeteo.ok === false` and decides what to
 * show for the missing piece.
 */
export async function getForecastBundle(
  { latitude, longitude }: Coordinates,
  now: number = Date.now(),
): Promise<ForecastBundle> {
  const [weatherApiResult, openMeteoResult] = await Promise.allSettled([
    fetchForecast(latitude, longitude),
    fetchDailyForecast(latitude, longitude),
  ]);

  if (weatherApiResult.status === "rejected") {
    throw weatherApiResult.reason;
  }

  const forecast = weatherApiResult.value;
  const daily =
    openMeteoResult.status === "fulfilled" ? openMeteoResult.value : null;

  const openMeteoStatus: SourceStatus =
    openMeteoResult.status === "fulfilled"
      ? { ok: true }
      : { ok: false, reason: reasonFor(openMeteoResult.reason) };

  return {
    location: normalizeLocation(forecast),
    current: normalizeCurrent(forecast.current),
    hourly: normalizeHourly(forecast, now),
    daily: daily ? normalizeDaily(daily) : [],
    astronomy: normalizeAstronomy(forecast, daily),
    airQuality: normalizeAirQuality(forecast.current),
    alerts: normalizeAlerts(forecast),
    sources: { weatherapi: { ok: true }, openMeteo: openMeteoStatus },
    fetchedAt: now,
  };
}
