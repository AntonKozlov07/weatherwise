import { WeatherError, fetchVendor } from "../errors";
import type { CityMatch } from "../types";
import {
  isForecastResponse,
  isSearchResponse,
  type RawForecastResponse,
} from "./raw";

const BASE_URL = "https://api.weatherapi.com/v1";

/**
 * Three days is the free plan's ceiling and gives 72 hourly points, comfortably
 * more than the 48 the app shows. The daily forecast deliberately does not come
 * from here (Decisions Log 6).
 */
const FORECAST_DAYS = 3;

/** Vendor readings update roughly every 10 to 15 minutes, so this is not stale. */
const REVALIDATE_SECONDS = 300;

function apiKey(): string {
  const key = process.env.WEATHER_API_KEY;

  if (!key) {
    throw new WeatherError("config", "Weather service is not configured.", {
      source: "WeatherAPI",
    });
  }

  return key;
}

async function getJson(path: string, params: URLSearchParams): Promise<unknown> {
  params.set("key", apiKey());

  try {
    const response = await fetchVendor(
      `${BASE_URL}/${path}?${params.toString()}`,
      "WeatherAPI",
      { next: { revalidate: REVALIDATE_SECONDS } },
    );

    return await response.json();
  } catch (error) {
    // A rejected key is our misconfiguration, not a blip worth retrying, so it
    // must not be reported to the user as a temporary network problem.
    if (
      error instanceof WeatherError &&
      (error.httpStatus === 401 || error.httpStatus === 403)
    ) {
      throw new WeatherError("config", "Weather service rejected the API key.", {
        source: "WeatherAPI",
        cause: error,
      });
    }

    throw error;
  }
}

export async function fetchForecast(
  latitude: number,
  longitude: number,
): Promise<RawForecastResponse> {
  const params = new URLSearchParams({
    q: `${latitude},${longitude}`,
    days: String(FORECAST_DAYS),
    aqi: "yes",
    alerts: "yes",
  });

  const payload = await getJson("forecast.json", params);

  if (!isForecastResponse(payload)) {
    throw new WeatherError("upstream", "Weather data came back malformed.", {
      source: "WeatherAPI",
    });
  }

  return payload;
}

export async function searchCities(query: string): Promise<CityMatch[]> {
  const payload = await getJson("search.json", new URLSearchParams({ q: query }));

  // An unmatched search is an empty array, not an error.
  if (!isSearchResponse(payload)) {
    throw new WeatherError("upstream", "City search came back malformed.", {
      source: "WeatherAPI",
    });
  }

  return payload.map((match) => ({
    id: match.id,
    name: match.name,
    region: match.region,
    country: match.country,
    latitude: match.lat,
    longitude: match.lon,
  }));
}
