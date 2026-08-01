import type { Coordinates } from "./coordinates";
import { fetchOpenMeteoForecast } from "@/lib/weather/openmeteo/client";
import { compareForecasts } from "@/lib/weather/openmeteo/compare";
import { buildNowcast } from "./nowcast";
import {
  fetchAirPollution,
  fetchAlerts,
  fetchCurrent,
  fetchDaily,
  fetchHourly,
  fetchMinutely,
  reverseGeocode,
} from "./openweather/client";
import {
  normalizeAirQuality,
  normalizeAlerts,
  normalizeAstronomy,
  normalizeCurrent,
  normalizeDaily,
  normalizeHourly,
  normalizeMinutely,
} from "./normalize";
import type { ForecastBundle } from "./types";

/**
 * Assembles the home screen payload from OpenWeatherMap.
 *
 * One Call 4.0 has no combined endpoint, so current, hourly and daily are three
 * separate requests, plus one per active alert. They run concurrently, and only
 * current is load bearing:
 *
 *  - current fails  -> nothing renders, so it propagates
 *  - hourly fails   -> the Hourly rail is empty, the rest still works
 *  - daily fails    -> the Weekly rail is empty, and the moon rows go missing
 *  - place or AQI   -> cosmetic, resolve to null
 *
 * Alerts need a second pass, because the weather records carry ids rather than
 * text. They are fetched after current lands.
 *
 * There is no batch mode: this is one set of calls per location, so saved
 * locations are fetched on demand rather than all at once.
 */
export async function getForecastBundle(
  { latitude, longitude }: Coordinates,
  now: number = Date.now(),
): Promise<ForecastBundle> {
  const [current, hourly, daily, minutely, place, air, second] = await Promise.all([
    fetchCurrent(latitude, longitude),
    // Settled rather than awaited outright, so one empty rail does not take
    // down a screen that is otherwise fine.
    fetchHourly(latitude, longitude).catch(() => null),
    fetchDaily(latitude, longitude).catch(() => null),
    // Regional. Absent for much of the world, and its own function already
    // swallows that into a null.
    fetchMinutely(latitude, longitude),
    reverseGeocode(latitude, longitude),
    fetchAirPollution(latitude, longitude),
    // A second opinion, from a different institution's model. Fetched in
    // parallel so it costs no latency, and it resolves to null rather than
    // throwing: the confidence signal is worth less than the forecast, so it
    // must never be able to take one down.
    fetchOpenMeteoForecast(latitude, longitude),
  ]);

  const record = current.data[0];
  const hours = normalizeHourly(hourly, now);
  const alerts = await fetchAlerts(record.alerts ?? []);

  return {
    location: {
      // One Call returns coordinates only. Without the reverse lookup there is
      // no name to show, so it falls back to the zone's city segment.
      name:
        place?.name ??
        current.timezone.split("/").pop()?.replace(/_/g, " ") ??
        "",
      region: place?.region ?? "",
      country: place?.country ?? "",
      latitude: current.lat,
      longitude: current.lon,
      timeZone: current.timezone,
    },
    current: normalizeCurrent(record),
    hourly: hours,
    daily: normalizeDaily(daily),
    astronomy: normalizeAstronomy(record, daily),
    airQuality: normalizeAirQuality(air),
    alerts: normalizeAlerts(alerts),
    nowcast: buildNowcast(normalizeMinutely(minutely)),
    agreement: compareForecasts(hours, second, current.timezone),
    fetchedAt: now,
  };
}
