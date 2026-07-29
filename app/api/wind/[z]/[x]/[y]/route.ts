import { WeatherError, errorResponse, fetchVendor } from "@/lib/weather/errors";

/**
 * GET /api/wind/{z}/{x}/{y}
 *
 * Proxies OpenWeatherMap's Weather Maps 1.0 `wind_new` tiles.
 *
 * A tile proxy exists because the key cannot reach the browser, and a tile URL
 * template in a MapLibre style is very much in the browser. Deliberately 1.0:
 * their 2.0 endpoints are paid (CLAUDE.md).
 */

const TILE_CACHE_SECONDS = 1_800;

function parseTileParam(value: string, max: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    throw new WeatherError("bad_request", "Bad tile coordinate.");
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ z: string; x: string; y: string }> },
): Promise<Response> {
  try {
    const { z, x, y } = await params;

    // Bounded before anything is fetched: these land in an upstream URL, and a
    // zoom of 30 would ask for a tile index in the billions.
    const zoom = parseTileParam(z, 12);
    const limit = 2 ** zoom - 1;
    const tileX = parseTileParam(x, limit);
    const tileY = parseTileParam(y, limit);

    const key = process.env.OPENWEATHER_API_KEY;

    if (!key) {
      throw new WeatherError("config", "Wind layer is not configured.", {
        source: "OpenWeatherMap",
      });
    }

    const response = await fetchVendor(
      `https://tile.openweathermap.org/map/wind_new/${zoom}/${tileX}/${tileY}.png?appid=${key}`,
      "OpenWeatherMap",
      { next: { revalidate: TILE_CACHE_SECONDS } },
    );

    return new Response(response.body, {
      headers: {
        "Content-Type": response.headers.get("Content-Type") ?? "image/png",
        "Cache-Control": `public, max-age=${TILE_CACHE_SECONDS}`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
