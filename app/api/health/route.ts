import { WEATHER_TILE_LAYERS, owmLayerId } from "@/lib/map/layers";
import { getForecastBundle } from "@/lib/weather/forecast";
import { ONE_CALL_VERSION } from "@/lib/weather/openweather/client";
import { WeatherError } from "@/lib/weather/errors";

/** The basemap needs no key, so it is not something this can fail on. */
const BASEMAP_NOTE = "CARTO Dark Matter, keyless";

/**
 * GET /api/health
 *
 * Says whether the deployment is actually wired up, so diagnosing a blank
 * screen does not need a local checkout. Reports whether each key is present,
 * which One Call version answered, and what came back.
 *
 * It never returns a key or any part of one, only whether it is set. Available
 * in production on purpose: production is where it is needed.
 */

/** Guelph, Ontario. Any populated coordinate pair would do. */
const PROBE = { latitude: 43.5448, longitude: -80.2482 };

/**
 * Fetches one real map tile and reports what came back.
 *
 * The map is the hardest thing to diagnose remotely: a blank canvas looks the
 * same whether the key is wrong, the layer name is wrong, or nothing is
 * rendering. A byte count settles it.
 */
async function probeTiles(): Promise<Record<string, unknown>> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return { ok: false, reason: "No OPENWEATHER_API_KEY set." };

  const results: Record<string, unknown> = {};

  for (const layer of WEATHER_TILE_LAYERS) {
    try {
      const response = await fetch(
        `https://tile.openweathermap.org/map/${owmLayerId(layer)}/7/36/44.png?appid=${key}`,
        { cache: "no-store" },
      );

      const bytes = response.ok
        ? (await response.arrayBuffer()).byteLength
        : 0;

      results[layer] = {
        ok: response.ok && bytes > 0,
        status: response.status,
        bytes,
        contentType: response.headers.get("Content-Type"),
      };
    } catch (error) {
      results[layer] = { ok: false, error: String(error).slice(0, 120) };
    }
  }

  return results;
}

export async function GET(): Promise<Response> {
  const keys = {
    OPENWEATHER_API_KEY: Boolean(process.env.OPENWEATHER_API_KEY),
    NEWS_API_KEY: Boolean(process.env.NEWS_API_KEY),
  };

  let weather: Record<string, unknown>;

  try {
    const bundle = await getForecastBundle(PROBE);

    weather = {
      ok: true,
      oneCallVersion: ONE_CALL_VERSION,
      place: bundle.location.name,
      timeZone: bundle.location.timeZone,
      current: {
        temperature: Math.round(bundle.current.temperature),
        condition: bundle.current.condition.label,
        conditionCode: bundle.current.condition.code,
      },
      hourlyPoints: bundle.hourly.length,
      dailyPoints: bundle.daily.length,
      alerts: bundle.alerts.length,
      // Both come from separate endpoints and are allowed to be absent.
      airQuality: bundle.airQuality ? bundle.airQuality.index : null,
      sunriseResolved: bundle.astronomy.sunrise !== null,
    };
  } catch (error) {
    weather = {
      ok: false,
      oneCallVersion: ONE_CALL_VERSION,
      kind: error instanceof WeatherError ? error.kind : "unknown",
      message:
        error instanceof WeatherError ? error.message : "Unexpected failure.",
    };
  }

  // Also probed when the forecast failed: the tile layers use the same key but
  // a different product, so one can work while the other does not.
  const tiles = await probeTiles();

  return Response.json(
    { keys, weather, tiles, basemap: BASEMAP_NOTE },
    { headers: { "Cache-Control": "no-store" } },
  );
}
