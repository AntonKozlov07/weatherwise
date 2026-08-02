import { archiveUrl } from "@/lib/weather/openmeteo/history";
import type { DayRecord } from "@/lib/history/on-this-day";

/**
 * This calendar day, every year the archive holds.
 *
 * One request per year would be eighty requests. Instead a single window is
 * requested and the days that are not today's date are discarded. That is
 * wasteful in bytes and frugal in requests, which is the right trade against an
 * API offered free on the understanding that use stays modest
 * (Decisions Log 103).
 *
 * Twenty years rather than eighty-five. The point is context for today, and a
 * measurement from 1943 does not make that better; it makes the request four
 * times larger.
 */

const YEARS = 20;
/** The archive lags real time by a few days, so the current year is not asked for. */
const LAG_DAYS = 7;
const TIMEOUT_MS = 12_000;
/**
 * Years requested at once.
 *
 * Twenty in one burst returned five. The endpoint was not rate limiting, and
 * every year fetched cleanly on its own: the requests simply did not all land
 * inside the timeout, and a year that times out is dropped silently, so the
 * screen showed a twenty-year record built from five years without ever saying
 * so. Batching keeps each request comfortably inside its window and is kinder
 * to an API offered free (Decisions Log 103).
 */
const BATCH = 5;
/** A day. This answer changes once every twenty-four hours by definition. */
const REVALIDATE_SECONDS = 86_400;

type RawArchive = {
  daily?: {
    time?: unknown;
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
    precipitation_sum?: unknown;
  };
};

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Requests one narrow window per year and stitches the results together.
 *
 * A single span covering twenty years would be seven thousand days to transfer
 * for the twenty that matter, so each year is asked for as a three-day window
 * around the date instead. Twenty small requests, run in parallel.
 */
export async function fetchOnThisDay(
  latitude: number,
  longitude: number,
  now: number = Date.now(),
): Promise<DayRecord[]> {
  const today = new Date(now);
  const month = today.getUTCMonth() + 1;
  const day = today.getUTCDate();

  // 29 February exists in the archive only in leap years, and asking for it in
  // a non-leap year returns nothing rather than an error. Falling back to the
  // 28th keeps the screen populated on the one day a year it would be empty.
  const safeDay = month === 2 && day === 29 ? 28 : day;

  const latest = new Date(now - LAG_DAYS * 86_400_000).getUTCFullYear();
  const years = Array.from({ length: YEARS }, (_, index) => latest - 1 - index);

  const fetchYear = async (year: number) => {
    const date = `${year}-${pad(month)}-${pad(safeDay)}`;
    // Built by the scaffolding module rather than assembled again here: two
    // places composing the same vendor URL is two places to get it wrong.
    const url = archiveUrl({ latitude, longitude, start: date, end: date });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        next: { revalidate: REVALIDATE_SECONDS },
      });

      if (!response.ok) return null;

      const raw = (await response.json()) as RawArchive;
      const high = Array.isArray(raw.daily?.temperature_2m_max)
        ? raw.daily.temperature_2m_max[0]
        : null;
      const low = Array.isArray(raw.daily?.temperature_2m_min)
        ? raw.daily.temperature_2m_min[0]
        : null;
      const rain = Array.isArray(raw.daily?.precipitation_sum)
        ? raw.daily.precipitation_sum[0]
        : 0;

      // A year with a gap in the record is dropped rather than zero-filled: a
      // fabricated 0° would become the coldest on record.
      if (typeof high !== "number" || typeof low !== "number") return null;

      return {
        year,
        high,
        low,
        precipitation: typeof rain === "number" ? rain : 0,
      } satisfies DayRecord;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const collected: DayRecord[] = [];

  for (let start = 0; start < years.length; start += BATCH) {
    const batch = await Promise.all(years.slice(start, start + BATCH).map(fetchYear));

    for (const record of batch) {
      if (record !== null) collected.push(record);
    }
  }

  return collected;
}
