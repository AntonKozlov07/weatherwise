import { WeatherError, fetchVendor } from "../errors";
import type { CityMatch } from "../types";
import {
  isAlertDetail,
  isCurrentResponse,
  isDailyResponse,
  isGeocodeResponse,
  isHourlyResponse,
  type RawAirPollution,
  type RawAlertDetail,
  type RawCurrentRecord,
  type RawDayRecord,
  type RawEnvelope,
  type RawHourRecord,
} from "./raw";

/**
 * OpenWeatherMap client. One key for every weather field in the app.
 *
 * One Call 4.0 splits the forecast across endpoints rather than returning it in
 * one payload, so a home screen costs three weather requests plus one per active
 * alert. Two free companion APIs fill the gaps One Call does not cover:
 * Geocoding for city search and place names, Air Pollution for AQI.
 */

const ONE_CALL_VERSION = "4.0";
const ONE_CALL_BASE = `https://api.openweathermap.org/data/${ONE_CALL_VERSION}/onecall`;
const GEOCODE_URL = "https://api.openweathermap.org/geo/1.0";
const AIR_POLLUTION_URL = "https://api.openweathermap.org/data/2.5/air_pollution";

/** Vendor readings update every 10 minutes or so, so this is not stale. */
const REVALIDATE_SECONDS = 300;
/** Place names essentially never change. */
const GEOCODE_REVALIDATE_SECONDS = 86_400;
/** Alert text does not change once issued; the id changes instead. */
const ALERT_REVALIDATE_SECONDS = 1_800;

/**
 * Alerts cost one request each. A location under a genuine multi-hazard warning
 * rarely has more than a couple, and the banner shows one at a time, so this
 * bounds the fan-out without hiding anything the user would have seen.
 */
const MAX_ALERTS = 3;

function apiKey(): string {
  const key = process.env.OPENWEATHER_API_KEY;

  if (!key) {
    throw new WeatherError("config", "Weather service is not configured.", {
      source: "OpenWeatherMap",
    });
  }

  return key;
}

function weatherParams(latitude: number, longitude: number): URLSearchParams {
  return new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    units: "metric",
    appid: apiKey(),
  });
}

async function getJson(url: string, revalidate: number): Promise<unknown> {
  try {
    const response = await fetchVendor(url, "OpenWeatherMap", {
      next: { revalidate },
    });

    return await response.json();
  } catch (error) {
    if (error instanceof WeatherError) {
      // A rejected key is our misconfiguration, not a blip worth retrying. One
      // Call also 401s when the account has no One Call subscription, which
      // needs the same non-retryable treatment and the same explanation.
      if (error.httpStatus === 401 || error.httpStatus === 403) {
        throw new WeatherError(
          "config",
          "Weather service rejected the API key. Check that the account has a One Call 4.0 subscription.",
          { source: "OpenWeatherMap", cause: error },
        );
      }

      // A 404 on a One Call path means the endpoint shape is wrong, which is a
      // code problem, not a transient one. Say so rather than blaming the network.
      if (error.httpStatus === 404 && url.startsWith(ONE_CALL_BASE)) {
        throw new WeatherError(
          "config",
          `One Call ${ONE_CALL_VERSION} did not recognise that endpoint.`,
          { source: "OpenWeatherMap", cause: error },
        );
      }
    }

    throw error;
  }
}

function malformed(what: string): WeatherError {
  return new WeatherError(
    "upstream",
    `${what} came back in an unexpected shape for One Call ${ONE_CALL_VERSION}.`,
    { source: "OpenWeatherMap" },
  );
}

export async function fetchCurrent(
  latitude: number,
  longitude: number,
): Promise<RawEnvelope<RawCurrentRecord>> {
  const payload = await getJson(
    `${ONE_CALL_BASE}/current?${weatherParams(latitude, longitude)}`,
    REVALIDATE_SECONDS,
  );

  if (!isCurrentResponse(payload)) throw malformed("Current conditions");

  return payload;
}

export async function fetchHourly(
  latitude: number,
  longitude: number,
): Promise<RawEnvelope<RawHourRecord>> {
  const payload = await getJson(
    `${ONE_CALL_BASE}/timeline/1h?${weatherParams(latitude, longitude)}`,
    REVALIDATE_SECONDS,
  );

  if (!isHourlyResponse(payload)) throw malformed("The hourly forecast");

  return payload;
}

export async function fetchDaily(
  latitude: number,
  longitude: number,
): Promise<RawEnvelope<RawDayRecord>> {
  const payload = await getJson(
    `${ONE_CALL_BASE}/timeline/1day?${weatherParams(latitude, longitude)}`,
    REVALIDATE_SECONDS,
  );

  if (!isDailyResponse(payload)) throw malformed("The daily forecast");

  return payload;
}

/**
 * Resolves alert ids to their text.
 *
 * Failures are swallowed per alert: a banner that cannot be filled in is worth
 * losing, a forecast is not.
 */
export async function fetchAlerts(ids: string[]): Promise<RawAlertDetail[]> {
  const unique = [...new Set(ids)].slice(0, MAX_ALERTS);

  const settled = await Promise.all(
    unique.map(async (id): Promise<RawAlertDetail | null> => {
      try {
        const payload = await getJson(
          `${ONE_CALL_BASE}/alert/${encodeURIComponent(id)}?appid=${apiKey()}`,
          ALERT_REVALIDATE_SECONDS,
        );

        if (!isAlertDetail(payload)) return null;

        // The id from the weather record wins: it is what the dismissal is
        // keyed on, whether or not the detail payload echoes it back.
        return { ...payload, id };
      } catch {
        return null;
      }
    }),
  );

  return settled.filter((alert): alert is RawAlertDetail => alert !== null);
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
