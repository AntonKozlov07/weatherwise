/**
 * Open-Meteo.
 *
 * A second, independent forecast, used only to say how much to trust the first.
 * OpenWeatherMap remains the source of every number the app displays: swapping
 * values between vendors would make the app inconsistent with itself, and the
 * point of a second opinion is confidence, not arbitration (Decisions Log 99).
 *
 * Keyless. There is no account, no dashboard and nothing to configure; the
 * coordinates the app already holds are the entire input. It is still called
 * server side like every other vendor, so the browser never talks to it
 * directly.
 *
 * Free use is offered on the understanding that it stays modest. Requests are
 * revalidated on the same schedule as the primary forecast rather than made per
 * view, and no endpoint here is called more than once per location per cycle.
 */

const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

/**
 * Observed history, from reanalysis. Reaches back decades, not to 2021.
 * Not called yet.
 */
export const ARCHIVE_API = "https://archive-api.open-meteo.com/v1/archive";

/**
 * Forecasts as they were issued, archived since 2021. Not called yet.
 *
 * This is the interesting one, and it is distinct from the archive above in a
 * way that matters. The archive says what the weather actually was. This says
 * what was predicted at the time, which is the other half of the pair needed to
 * measure how wrong a forecast tends to be for a given place.
 *
 * The consequence is that forecast-accuracy scoring does not have to accumulate
 * slowly from today. Several years of both halves already exist and can be
 * backfilled in one pass (Decisions Log 100).
 */
export const HISTORICAL_FORECAST_API =
  "https://historical-forecast-api.open-meteo.com/v1/forecast";

/**
 * Open-Meteo publishes no map tiles.
 *
 * The weather map on their site is their own interface over the same point
 * data, not a service anything can call, so there is no endpoint to put here.
 * If map imagery is wanted it has to come from OpenWeatherMap or RainViewer as
 * it does now.
 *
 * The nearest thing they do offer is the Ensemble API, which returns many runs
 * of the same model. That is a stronger uncertainty signal than comparing two
 * vendors, because the spread is the model's own disagreement with itself.
 * Worth considering if the comparison below proves useful.
 */
export const ENSEMBLE_API = "https://ensemble-api.open-meteo.com/v1/ensemble";

/** Matches the primary forecast, so the two are never a cycle out of step. */
const REVALIDATE_SECONDS = 600;
/** A second opinion is not worth delaying the screen for. */
const TIMEOUT_MS = 4_000;

export type OpenMeteoForecast = {
  /** ISO local times, matching `timezone=auto`. */
  time: string[];
  temperature: number[];
  precipitationChance: number[];
  precipitation: number[];
};

type RawForecast = {
  hourly?: {
    time?: unknown;
    temperature_2m?: unknown;
    precipitation_probability?: unknown;
    precipitation?: unknown;
  };
};

function numbers(value: unknown): number[] | null {
  if (!Array.isArray(value)) return null;
  // Open-Meteo uses null for a gap rather than omitting the hour, so the arrays
  // stay index-aligned with `time` and nulls become zero rather than shifting
  // every later hour by one.
  return value.map((entry) => (typeof entry === "number" ? entry : 0));
}

/**
 * The next two days, hourly.
 *
 * Returns null on any failure, including a timeout. Nothing the app shows
 * depends on this, so a fault here must be silent rather than an error state:
 * losing the confidence signal is a smaller loss than losing the forecast.
 */
export async function fetchOpenMeteoForecast(
  latitude: number,
  longitude: number,
): Promise<OpenMeteoForecast | null> {
  const url =
    `${FORECAST_API}?latitude=${latitude}&longitude=${longitude}` +
    "&hourly=temperature_2m,precipitation,precipitation_probability" +
    "&forecast_days=3&timezone=auto";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) return null;

    const raw = (await response.json()) as RawForecast;

    const time = Array.isArray(raw.hourly?.time)
      ? raw.hourly.time.filter((entry): entry is string => typeof entry === "string")
      : null;
    const temperature = numbers(raw.hourly?.temperature_2m);
    const precipitationChance = numbers(raw.hourly?.precipitation_probability);
    const precipitation = numbers(raw.hourly?.precipitation);

    if (!time || !temperature || !precipitationChance || !precipitation) return null;
    if (time.length === 0 || temperature.length !== time.length) return null;

    return { time, temperature, precipitationChance, precipitation };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
