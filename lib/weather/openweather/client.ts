import { WeatherError, fetchVendor } from "../errors";
import type { CityMatch } from "../types";
import {
  isGeocodeResponse,
  isOneCallResponse,
  type RawAirPollution,
  type RawOneCallResponse,
} from "./raw";

/**
 * OpenWeatherMap client. One vendor for every weather field the app shows.
 *
 * Three endpoints, because One Call does not cover everything WeatherAPI did:
 *
 *  - One Call: current, hourly, daily, alerts
 *  - Geocoding: city search and place names, which One Call omits entirely
 *  - Air Pollution: AQI, which One Call also omits
 *
 * All three take the same key. Geocoding and Air Pollution are free tier.
 */

/** Version is a constant so a change is one edit, not a search. */
const ONE_CALL_VERSION = "4.0";
const ONE_CALL_URL = `https://api.openweathermap.org/data/${ONE_CALL_VERSION}/onecall`;
const GEOCODE_URL = "https://api.openweathermap.org/geo/1.0";
const AIR_POLLUTION_URL = "https://api.openweathermap.org/data/2.5/air_pollution";

/** Vendor readings update every 10 minutes or so, so this is not stale. */
const REVALIDATE_SECONDS = 300;
/** Place names essentially never change. */
const GEOCODE_REVALIDATE_SECONDS = 86_400;

function apiKey(): string {
  const key = process.env.OPENWEATHER_API_KEY;

  if (!key) {
    throw new WeatherError("config", "Weather service is not configured.", {
      source: "OpenWeatherMap",
    });
  }

  return key;
}

async function getJson(url: string, revalidate: number): Promise<unknown> {
  try {
    const response = await fetchVendor(url, "OpenWeatherMap", {
      next: { revalidate },
    });

    return await response.json();
  } catch (error) {
    // A rejected key is our misconfiguration, not a blip worth retrying. One
    // Call also 401s when the account has no One Call subscription, which is
    // the same class of problem and needs the same non-retryable treatment.
    if (
      error instanceof WeatherError &&
      (error.httpStatus === 401 || error.httpStatus === 403)
    ) {
      throw new WeatherError(
        "config",
        "Weather service rejected the API key. Check that the account has a One Call subscription.",
        { source: "OpenWeatherMap", cause: error },
      );
    }

    throw error;
  }
}

export async function fetchOneCall(
  latitude: number,
  longitude: number,
): Promise<RawOneCallResponse> {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    units: "metric",
    // Minutely is not rendered anywhere, so it is excluded rather than fetched
    // and thrown away.
    exclude: "minutely",
    appid: apiKey(),
  });

  const payload = await getJson(
    `${ONE_CALL_URL}?${params.toString()}`,
    REVALIDATE_SECONDS,
  );

  if (!isOneCallResponse(payload)) {
    throw new WeatherError(
      "upstream",
      `Weather data came back in an unexpected shape for One Call ${ONE_CALL_VERSION}.`,
      { source: "OpenWeatherMap" },
    );
  }

  return payload;
}

/**
 * City search. One Call takes coordinates only and returns no place names, so
 * this is what makes saved locations and the search field possible at all.
 */
export async function searchCities(query: string): Promise<CityMatch[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "8",
    appid: apiKey(),
  });

  const payload = await getJson(
    `${GEOCODE_URL}/direct?${params.toString()}`,
    GEOCODE_REVALIDATE_SECONDS,
  );

  // An unmatched search is an empty array, not an error.
  if (!isGeocodeResponse(payload)) {
    throw new WeatherError("upstream", "City search came back malformed.", {
      source: "OpenWeatherMap",
    });
  }

  return payload.map((match, index) => ({
    // Geocoding has no stable id, so one is derived from the coordinates.
    id: index,
    name: match.name,
    region: match.state ?? "",
    country: match.country ?? "",
    latitude: match.lat,
    longitude: match.lon,
  }));
}

/**
 * Reverse geocode, for the place name the header shows.
 *
 * Returns null rather than throwing: a missing name is a cosmetic loss, and it
 * must not take down a forecast that loaded fine.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
): Promise<{ name: string; region: string; country: string } | null> {
  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      limit: "1",
      appid: apiKey(),
    });

    const payload = await getJson(
      `${GEOCODE_URL}/reverse?${params.toString()}`,
      GEOCODE_REVALIDATE_SECONDS,
    );

    if (!isGeocodeResponse(payload) || payload.length === 0) return null;

    const [match] = payload;
    return {
      name: match.name,
      region: match.state ?? "",
      country: match.country ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Air quality, which One Call does not carry.
 *
 * Returns null on failure for the same reason as the place name: the home
 * screen is still worth rendering without it.
 */
export async function fetchAirPollution(
  latitude: number,
  longitude: number,
): Promise<{ aqi: number; components: Record<string, number> } | null> {
  try {
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      appid: apiKey(),
    });

    const payload = (await getJson(
      `${AIR_POLLUTION_URL}?${params.toString()}`,
      REVALIDATE_SECONDS,
    )) as RawAirPollution;

    const entry = payload.list?.[0];
    if (!entry?.main?.aqi) return null;

    return { aqi: entry.main.aqi, components: entry.components ?? {} };
  } catch {
    return null;
  }
}

export { ONE_CALL_VERSION };
