import type { Coordinates } from "./coordinates";
import {
  fetchAirPollution,
  fetchOneCall,
  reverseGeocode,
} from "./openweather/client";
import {
  normalizeAirQuality,
  normalizeAlerts,
  normalizeAstronomy,
  normalizeCurrent,
  normalizeDaily,
  normalizeHourly,
} from "./normalize";
import type { ForecastBundle } from "./types";

/**
 * Assembles the home screen payload from OpenWeatherMap.
 *
 * Three requests, because One Call covers neither place names nor air quality
 * (Decisions Log 42). They run concurrently, and only One Call is load bearing:
 * the other two resolve to null on failure, because a missing city name or AQI
 * reading is not worth failing a forecast that otherwise loaded.
 *
 * One Call takes a single lat/lon per request and has no batch mode, so this is
 * one call per location. Saved locations are fetched on demand rather than all
 * at once, which keeps that linear cost off the home screen.
 */
export async function getForecastBundle(
  { latitude, longitude }: Coordinates,
  now: number = Date.now(),
): Promise<ForecastBundle> {
  const [oneCall, place, air] = await Promise.all([
    fetchOneCall(latitude, longitude),
    reverseGeocode(latitude, longitude),
    fetchAirPollution(latitude, longitude),
  ]);

  return {
    location: {
      // One Call returns coordinates only. Without the reverse lookup there is
      // no name to show, so it falls back to the zone's city segment.
      name: place?.name ?? oneCall.timezone.split("/").pop()?.replace(/_/g, " ") ?? "",
      region: place?.region ?? "",
      country: place?.country ?? "",
      latitude: oneCall.lat,
      longitude: oneCall.lon,
      timeZone: oneCall.timezone,
    },
    current: normalizeCurrent(oneCall.current),
    hourly: normalizeHourly(oneCall, now),
    daily: normalizeDaily(oneCall),
    astronomy: normalizeAstronomy(oneCall),
    airQuality: normalizeAirQuality(air),
    alerts: normalizeAlerts(oneCall),
    fetchedAt: now,
  };
}
