import { getForecastBundle } from "@/lib/weather/forecast";
import { activeOneCallVersion, ONE_CALL_VERSIONS } from "@/lib/weather/openweather/client";
import { WeatherError } from "@/lib/weather/errors";

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
      oneCallVersion: activeOneCallVersion(),
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
      versionsTried: [...ONE_CALL_VERSIONS],
      kind: error instanceof WeatherError ? error.kind : "unknown",
      message:
        error instanceof WeatherError ? error.message : "Unexpected failure.",
    };
  }

  return Response.json(
    { keys, weather },
    { headers: { "Cache-Control": "no-store" } },
  );
}
