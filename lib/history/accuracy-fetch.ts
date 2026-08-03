import { ARCHIVE_API, HISTORICAL_FORECAST_API } from "@/lib/weather/openmeteo/client";
import type { DayPair } from "@/lib/history/accuracy";

/**
 * Fetches both halves of the accuracy measurement.
 *
 * Two requests, not forty: both endpoints take a date range and return daily
 * arrays, so a whole window costs one call each. That is the difference between
 * this and the on-this-day query, which needs the same calendar date across
 * many years and therefore cannot be one range (Decisions Log 115).
 *
 * The archive lags real time by several days, so the window ends before now
 * rather than at it. Asking for days the archive has not published yet would
 * return nulls that look like a forecast that got everything wrong.
 */

const LAG_DAYS = 6;
const WINDOW_DAYS = 30;
const TIMEOUT_MS = 12_000;
/** A day. Neither half changes more often than that. */
const REVALIDATE_SECONDS = 86_400;

type RawDaily = {
  daily?: {
    time?: unknown;
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
  };
};

function isoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

async function daily(url: string): Promise<Map<string, { high: number; low: number }>> {
  const out = new Map<string, { high: number; low: number }>();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!response.ok) return out;

    const raw = (await response.json()) as RawDaily;
    const times = Array.isArray(raw.daily?.time) ? raw.daily.time : [];
    const highs = Array.isArray(raw.daily?.temperature_2m_max)
      ? raw.daily.temperature_2m_max
      : [];
    const lows = Array.isArray(raw.daily?.temperature_2m_min)
      ? raw.daily.temperature_2m_min
      : [];

    times.forEach((date, index) => {
      const high = highs[index];
      const low = lows[index];

      // A gap is skipped rather than zero-filled: a fabricated 0° would read as
      // a spectacular forecast failure.
      if (typeof date !== "string") return;
      if (typeof high !== "number" || typeof low !== "number") return;

      out.set(date, { high, low });
    });

    return out;
  } catch {
    return out;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAccuracyPairs(
  latitude: number,
  longitude: number,
  now: number = Date.now(),
): Promise<DayPair[]> {
  const end = now - LAG_DAYS * 86_400_000;
  const start = end - WINDOW_DAYS * 86_400_000;

  const range =
    `latitude=${latitude}&longitude=${longitude}` +
    `&start_date=${isoDate(start)}&end_date=${isoDate(end)}` +
    "&daily=temperature_2m_max,temperature_2m_min&timezone=auto";

  const [predicted, observed] = await Promise.all([
    daily(`${HISTORICAL_FORECAST_API}?${range}`),
    daily(`${ARCHIVE_API}?${range}`),
  ]);

  const pairs: DayPair[] = [];

  for (const [date, forecast] of predicted) {
    const actual = observed.get(date);
    // Only days present in both halves can be compared at all.
    if (!actual) continue;

    pairs.push({
      date,
      forecastHigh: forecast.high,
      forecastLow: forecast.low,
      actualHigh: actual.high,
      actualLow: actual.low,
    });
  }

  return pairs.sort((a, b) => a.date.localeCompare(b.date));
}
