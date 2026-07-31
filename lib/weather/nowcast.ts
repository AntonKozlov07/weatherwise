import type { MinutelyPoint, Nowcast } from "./types";

/**
 * Minute-by-minute precipitation, turned into a sentence and a shape.
 *
 * One Call 4.0 serves this from /onecall/timeline/1min and only for some
 * regions, so every caller has to cope with it being absent entirely
 * (Decisions Log 56).
 *
 * Framework-free and pure, so the sentence logic is testable without rendering.
 */

/**
 * Below this, `precipitation` is reporting noise rather than rain anyone would
 * notice. Treating any non-zero value as "rain" produced "Rain starting in 3
 * minutes" for a trace of 0.02 mm/h that never materialised.
 */
const WET_THRESHOLD_MM_H = 0.1;

/** Intensity bands, mm/h. Used for both the wording and the bar colour. */
const BANDS = [
  { max: 0.5, label: "Light rain", intensity: 0.25 },
  { max: 2.5, label: "Rain", intensity: 0.55 },
  { max: 7.6, label: "Heavy rain", intensity: 0.8 },
  { max: Infinity, label: "Downpour", intensity: 1 },
] as const;

function isWet(point: MinutelyPoint): boolean {
  return point.precipitation >= WET_THRESHOLD_MM_H;
}

function band(mmPerHour: number) {
  return BANDS.find((entry) => mmPerHour < entry.max) ?? BANDS[BANDS.length - 1];
}

/** 0 to 1, for bar height and colour. Square-rooted so a drizzle is visible. */
export function intensityOf(mmPerHour: number): number {
  if (mmPerHour < WET_THRESHOLD_MM_H) return 0;
  return Math.min(1, Math.sqrt(mmPerHour / 10));
}

/**
 * Minutes until the wet/dry state first flips.
 *
 * Deliberately a transition search rather than a look at the first value: what
 * matters is when it changes, and a scan that only checked `minutely[0]` would
 * say "no rain expected" through a downpour arriving in ten minutes.
 */
function firstTransition(points: MinutelyPoint[]): number | null {
  if (points.length === 0) return null;

  const startsWet = isWet(points[0]);
  const index = points.findIndex((point) => isWet(point) !== startsWet);

  return index === -1 ? null : index;
}

export function buildNowcast(points: MinutelyPoint[] | null): Nowcast | null {
  if (!points || points.length === 0) return null;

  const startsWet = isWet(points[0]);
  const transition = firstTransition(points);
  const peak = Math.max(...points.map((point) => point.precipitation));

  let headline: string;

  if (startsWet && transition === null) {
    headline = `${band(peak).label} for the next hour`;
  } else if (startsWet) {
    headline = `Rain stopping in ${transition} min`;
  } else if (transition !== null) {
    // Names the intensity that is coming, not just that something is.
    const arriving = Math.max(
      ...points.slice(transition).map((point) => point.precipitation),
    );
    headline = `${band(arriving).label} starting in ${transition} min`;
  } else {
    headline = "No rain expected in the next hour";
  }

  return {
    headline,
    points,
    peak,
    /** Lets the card skip rendering a chart that would be a flat empty line. */
    hasPrecipitation: points.some(isWet),
  };
}
