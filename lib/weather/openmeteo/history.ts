import { ARCHIVE_API, HISTORICAL_FORECAST_API } from "@/lib/weather/openmeteo/client";

/**
 * Historical weather. Scaffolding only: nothing here is called yet.
 *
 * Two distinct products, and the difference between them is the whole reason
 * this file exists.
 *
 *   Archive              what the weather actually was, from reanalysis.
 *   Historical forecast  what was predicted at the time, archived since 2021.
 *
 * Together they are the two halves needed to measure how wrong a forecast tends
 * to be for a particular place: prediction on one side, outcome on the other.
 * The consequence is that forecast-accuracy scoring does not have to accumulate
 * from today onward. Several years of both already exist, so it can be
 * backfilled in a single pass and be useful immediately rather than in a month
 * (Decisions Log 100).
 *
 * Left uncalled deliberately. Wiring it in means deciding where the results
 * live, how often they refresh, and what the app does with a correction once it
 * has one, and none of that is decided yet. The types and the request shapes
 * are here so that work starts from something verified rather than from a
 * documentation page.
 */

export type DailyHistory = {
  /** ISO dates, local to the requested coordinates. */
  date: string[];
  high: number[];
  low: number[];
  precipitation: number[];
};

export type HourlyHistory = {
  /** Local ISO stamps, as returned under `timezone=auto`. */
  time: string[];
  temperature: number[];
  precipitation: number[];
};

/** Both endpoints take the same window. Inclusive, and in local dates. */
export type HistoryWindow = {
  latitude: number;
  longitude: number;
  /** "2021-07-01" */
  start: string;
  end: string;
};

/**
 * Earliest date the archive covers. It reaches back decades, far further than
 * the forecast archive, so a comparison between the two is bounded by the
 * latter rather than this.
 */
export const ARCHIVE_FROM = "1940-01-01";

/** Earliest date archived forecasts exist for. */
export const HISTORICAL_FORECAST_FROM = "2021-01-01";

/**
 * What the weather actually was.
 *
 * Not implemented. The request shape is verified against the live endpoint;
 * only the call and its parsing are missing.
 */
export function archiveUrl(window: HistoryWindow): string {
  return (
    `${ARCHIVE_API}?latitude=${window.latitude}&longitude=${window.longitude}` +
    `&start_date=${window.start}&end_date=${window.end}` +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum" +
    "&timezone=auto"
  );
}

/**
 * What was forecast at the time.
 *
 * Not implemented, as above. Note that this returns the forecast as issued,
 * so comparing it against `archiveUrl` for the same window is the measurement
 * itself rather than an approximation of one.
 */
export function historicalForecastUrl(window: HistoryWindow): string {
  return (
    `${HISTORICAL_FORECAST_API}?latitude=${window.latitude}` +
    `&longitude=${window.longitude}` +
    `&start_date=${window.start}&end_date=${window.end}` +
    "&hourly=temperature_2m,precipitation" +
    "&timezone=auto"
  );
}

/**
 * The remaining work, recorded so it is not rediscovered:
 *
 *  1. A table keyed by rounded coordinate and date, holding predicted against
 *     observed. The push subscriptions table is already Postgres, so there is
 *     somewhere to put it.
 *  2. A backfill that walks a couple of years at a sensible rate. Open-Meteo is
 *     free on the understanding that use stays modest, so this belongs in one
 *     deliberate job rather than in a request path.
 *  3. A decision about what a measured bias is for. Silently correcting the
 *     displayed number is tempting and probably wrong: it would make the app
 *     disagree with every other forecast without saying why. Stating it is
 *     more honest, and it is the same argument as the confidence signal.
 */
