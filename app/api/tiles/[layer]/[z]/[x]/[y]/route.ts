import { isWeatherTileLayer, owmLayerId } from "@/lib/map/layers";
import { WeatherError, errorResponse, fetchVendor } from "@/lib/weather/errors";

/**
 * GET /api/tiles/{layer}/{z}/{x}/{y}
 *
 * Proxies OpenWeatherMap Weather Maps 1.0 tiles, so precipitation and wind come
 * from the same vendor and key as every other weather field.
 *
 * The proxy exists because the key cannot reach the browser, and a MapLibre
 * tile template is very much in the browser.
 */

const TILE_CACHE_SECONDS = 600;

function parseTileParam(value: string, max: number): number {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
    throw new WeatherError("bad_request", "Bad tile coordinate.");
  }

  return parsed;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ layer: string; z: string; x: string; y: string }> },
): Promise<Response> {
  try {
    const { layer, z, x, y } = await params;

    if (!isWeatherTileLayer(layer)) {
      throw new WeatherError("bad_request", "Unknown map layer.");
    }

    // Bounded before anything is fetched: these land in an upstream URL, and a
    // zoom of 30 would ask for a tile index in the billions.
    const zoom = parseTileParam(z, 12);
    const limit = 2 ** zoom - 1;
    const tileX = parseTileParam(x, limit);
    const tileY = parseTileParam(y, limit);

    const key = process.env.OPENWEATHER_API_KEY;

    if (!key) {
      throw new WeatherError("config", "Map layers are not configured.", {
        source: "OpenWeatherMap",
      });
    }

    const response = await fetchVendor(
      `https://tile.openweathermap.org/map/${owmLayerId(layer)}/${zoom}/${tileX}/${tileY}.png?appid=${key}`,
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
