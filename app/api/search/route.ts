import { WeatherError, errorResponse } from "@/lib/weather/errors";
import { searchCities } from "@/lib/weather/openweather/client";

/** Below this, geocoding matches too broadly to be useful. */
const MIN_QUERY_LENGTH = 2;

/**
 * GET /api/search?q=
 *
 * City search, backed by OpenWeatherMap's Geocoding API. One Call takes
 * coordinates only and returns no place names, so this is what makes saved
 * locations possible at all.
 *
 * An unmatched query is an empty list and a 200, not an error.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const query = (new URL(request.url).searchParams.get("q") ?? "").trim();

    if (query.length < MIN_QUERY_LENGTH) {
      throw new WeatherError(
        "bad_request",
        `Search needs at least ${MIN_QUERY_LENGTH} characters.`,
      );
    }

    const matches = await searchCities(query);

    return Response.json(
      { matches },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
