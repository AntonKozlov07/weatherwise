import type { OpenMeteoForecast } from "@/lib/weather/openmeteo/client";
import type { HourlyPoint } from "@/lib/weather/types";

/**
 * How much two independent forecasts agree.
 *
 * Where two models built by different institutions from different data land on
 * the same answer, that answer is worth trusting. Where they diverge, the
 * weather is genuinely uncertain, and saying so is more honest than presenting
 * either number as fact. This is the amateur version of what forecasters do
 * with ensemble spread (Decisions Log 99).
 *
 * Numbers are compared, never condition codes. Open-Meteo uses WMO codes and
 * OpenWeatherMap uses its own, and mapping between the two taxonomies is a pit
 * of edge cases that would introduce disagreements which are really just
 * translation losses. A degree is a degree in both.
 *
 * Pure, so the thresholds can be argued with in a test rather than discovered
 * on a phone.
 */

export type Confidence = "high" | "moderate" | "low";

export type ForecastAgreement = {
  confidence: Confidence;
  /** Mean absolute temperature difference, in degrees, over the window. */
  temperatureGap: number;
  /** Hours where one model expects rain and the other does not. */
  disagreeingHours: number;
  /** How many hours could actually be compared. */
  comparedHours: number;
};

/**
 * Thresholds.
 *
 * Deliberately generous. Two models will never agree exactly, and treating a
 * degree of difference as uncertainty would mark every forecast low confidence,
 * which tells the reader nothing. These are set where a difference starts to
 * change what someone would do.
 */
const CLOSE_ENOUGH_C = 1.5;
const MEANINGFUL_GAP_C = 3;
/** Above this chance, a model is saying it expects rain. */
const WET_CHANCE = 50;
/** Fewer than this and the sample is too small to draw a conclusion from. */
const MIN_HOURS = 6;

/** The window compared. A disagreement three days out is not today's problem. */
const WINDOW_HOURS = 24;

function hourKey(time: number, timeZone: string): string {
  // Open-Meteo returns local ISO strings under `timezone=auto`, so the primary
  // forecast's instants are rendered the same way to line the two up. Matching
  // on epoch would fail: the two vendors stamp the hour differently.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(time);

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";

  // "2026-08-01T14"
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour").padStart(2, "0")}`;
}

export function compareForecasts(
  hourly: HourlyPoint[],
  other: OpenMeteoForecast | null,
  timeZone: string,
): ForecastAgreement | null {
  if (!other) return null;

  const theirs = new Map<string, { temperature: number; chance: number }>();

  other.time.forEach((stamp, index) => {
    // "2026-08-01T14:00" trimmed to the hour, which is how ours is keyed.
    theirs.set(stamp.slice(0, 13), {
      temperature: other.temperature[index] ?? 0,
      chance: other.precipitationChance[index] ?? 0,
    });
  });

  let gapSum = 0;
  let compared = 0;
  let disagreeing = 0;

  for (const hour of hourly.slice(0, WINDOW_HOURS)) {
    const match = theirs.get(hourKey(hour.time, timeZone));
    if (!match) continue;

    compared += 1;
    gapSum += Math.abs(hour.temperature - match.temperature);

    const oursWet = hour.precipitationChance >= WET_CHANCE;
    const theirsWet = match.chance >= WET_CHANCE;

    if (oursWet !== theirsWet) disagreeing += 1;
  }

  // Too little overlap to say anything. Null rather than a guess: the absence
  // of a confidence signal is honest, a fabricated one is not.
  if (compared < MIN_HOURS) return null;

  const temperatureGap = gapSum / compared;
  const disagreementRate = disagreeing / compared;

  const confidence: Confidence =
    temperatureGap >= MEANINGFUL_GAP_C || disagreementRate >= 0.3
      ? "low"
      : temperatureGap <= CLOSE_ENOUGH_C && disagreementRate === 0
        ? "high"
        : "moderate";

  return {
    confidence,
    temperatureGap: Math.round(temperatureGap * 10) / 10,
    disagreeingHours: disagreeing,
    comparedHours: compared,
  };
}
