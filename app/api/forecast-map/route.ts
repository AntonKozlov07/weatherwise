import { gridCoordinates, parseForecastGrid } from "@/lib/map/forecast-grid";
import { parseCoordinates } from "@/lib/weather/coordinates";
import { errorResponse } from "@/lib/weather/errors";

/**
 * GET /api/forecast-map?lat=&lon=
 *
 * A grid of point forecasts around a location, for the map's forward layer.
 * One upstream request covers all forty-nine points and three days.
 *
 * Keyless, and routed through the server like every other vendor call.
 */

const API = "https://api.open-meteo.com/v1/forecast";
/** Matches the primary forecast so the two cannot drift a cycle apart. */
const REVALIDATE_SECONDS = 600;
const TIMEOUT_MS = 9_000;

export async function GET(request: Request): Promise<Response> {
  try {
    const { latitude, longitude } = parseCoordinates(
      new URL(request.url).searchParams,
    );

    const { latitudes, longitudes } = gridCoordinates(latitude, longitude);

    const url =
      `${API}?latitude=${latitudes.join(",")}&longitude=${longitudes.join(",")}` +
      "&hourly=precipitation&forecast_days=3&timezone=auto";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: REVALIDATE_SECONDS },
      });

      if (!response.ok) return Response.json({ grid: null });

      // Trimmed to now, so hour zero on the scrubber is the hour you are in
      // rather than midnight this morning.
      const grid = parseForecastGrid(await response.json(), Date.now());

      return Response.json(
        { grid },
        {
          headers: {
            "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
          },
        },
      );
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
