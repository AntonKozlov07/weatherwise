import { WeatherError, fetchVendor } from "../errors";
import { isDailyResponse, type RawDailyResponse } from "./raw";

const BASE_URL = "https://api.open-meteo.com/v1/forecast";

/** The Weekly rail shows 7; 10 leaves headroom without a second request. */
const FORECAST_DAYS = 10;

const REVALIDATE_SECONDS = 900;

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "precipitation_probability_max",
  "precipitation_sum",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
  "wind_direction_10m_dominant",
  "uv_index_max",
  "sunrise",
  "sunset",
] as const;

/**
 * Keyless and unlimited, so no credential handling here.
 *
 * `timeformat=unixtime` matters: it makes sunrise and sunset real instants,
 * which is what the gradient anchors to. The default ISO output omits the
 * offset and would have to be reconstructed from the zone.
 */
export async function fetchDailyForecast(
  latitude: number,
  longitude: number,
): Promise<RawDailyResponse> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: DAILY_FIELDS.join(","),
    timezone: "auto",
    timeformat: "unixtime",
    forecast_days: String(FORECAST_DAYS),
    temperature_unit: "celsius",
    wind_speed_unit: "kmh",
    precipitation_unit: "mm",
  });

  const response = await fetchVendor(
    `${BASE_URL}?${params.toString()}`,
    "Open-Meteo",
    { next: { revalidate: REVALIDATE_SECONDS } },
  );

  const payload: unknown = await response.json();

  if (!isDailyResponse(payload)) {
    throw new WeatherError("upstream", "Daily forecast came back malformed.", {
      source: "Open-Meteo",
    });
  }

  return payload;
}
