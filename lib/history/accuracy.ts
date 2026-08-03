/**
 * How wrong the forecast tends to be here.
 *
 * Two archives, compared. Open-Meteo keeps what was predicted at the time back
 * to 2021, and separately what the weather actually turned out to be. Setting
 * one against the other for the same days is a measurement rather than an
 * impression, and no accumulation is needed: several years of both already
 * exist (Decisions Log 115).
 *
 * The point is not to correct the number on the home screen. Quietly shifting a
 * displayed temperature would make this app disagree with every other forecast
 * without saying why, and a reader who noticed would have no way to tell a
 * correction from a bug. Stating the error plainly is the honest version, and
 * it is the same argument as the confidence signal.
 */

export type DayPair = {
  /** ISO date, local to the location. */
  date: string;
  forecastHigh: number;
  forecastLow: number;
  actualHigh: number;
  actualLow: number;
};

export type Accuracy = {
  /** Days compared. */
  days: number;
  /** Mean absolute error on the daily high, in degrees. */
  highError: number;
  lowError: number;
  /**
   * Signed mean on the high. Positive means the forecast ran warm, which is the
   * more useful fact: a consistent lean is correctable by the reader, where a
   * symmetric scatter is not.
   */
  highBias: number;
  /** Share of days the high landed within a degree and a half. */
  withinTolerance: number;
  /** The worst miss in the window, for honesty about the tail. */
  worst: { date: string; error: number } | null;
};

/** Close enough that nobody would have planned differently. */
const TOLERANCE_C = 1.5;
/** Below this the number would be noise dressed as a measurement. */
const MIN_DAYS = 7;

export function measureAccuracy(pairs: DayPair[]): Accuracy | null {
  if (pairs.length < MIN_DAYS) return null;

  let highErrorSum = 0;
  let lowErrorSum = 0;
  let biasSum = 0;
  let within = 0;
  let worst: Accuracy["worst"] = null;

  for (const pair of pairs) {
    const highError = pair.forecastHigh - pair.actualHigh;
    const absolute = Math.abs(highError);

    highErrorSum += absolute;
    lowErrorSum += Math.abs(pair.forecastLow - pair.actualLow);
    biasSum += highError;

    if (absolute <= TOLERANCE_C) within += 1;

    if (!worst || absolute > Math.abs(worst.error)) {
      worst = { date: pair.date, error: Math.round(highError * 10) / 10 };
    }
  }

  const round = (value: number) => Math.round((value / pairs.length) * 10) / 10;

  return {
    days: pairs.length,
    highError: round(highErrorSum),
    lowError: round(lowErrorSum),
    highBias: round(biasSum),
    withinTolerance: Math.round((within / pairs.length) * 100),
    worst,
  };
}

/**
 * The measurement in words.
 *
 * Written here rather than in the component because the interesting part is
 * which fact deserves saying, and that is a judgement about the numbers rather
 * than about layout. A lean worth acting on outranks an average nobody can use.
 */
export function accuracySummary(accuracy: Accuracy): string[] {
  const lines: string[] = [];

  lines.push(
    `Over the last ${accuracy.days} days, the forecast high here was off by ${accuracy.highError}° on average.`,
  );

  // A consistent lean is the useful finding: it is correctable by the reader.
  // Scatter around zero is not, and saying "no consistent bias" is worth more
  // than reporting a meaningless signed average of 0.1.
  if (Math.abs(accuracy.highBias) >= 1) {
    const warm = accuracy.highBias > 0;
    lines.push(
      `It leans ${warm ? "warm" : "cold"} by about ${Math.abs(accuracy.highBias)}°, so ${warm ? "expect a little cooler" : "expect a little warmer"} than it says.`,
    );
  } else {
    lines.push("It misses in both directions rather than leaning one way.");
  }

  lines.push(`${accuracy.withinTolerance}% of days landed within a degree and a half.`);

  if (accuracy.worst && Math.abs(accuracy.worst.error) >= 4) {
    const warm = accuracy.worst.error > 0;
    lines.push(
      `The worst miss was ${Math.abs(accuracy.worst.error)}° too ${warm ? "warm" : "cold"}, on ${accuracy.worst.date}.`,
    );
  }

  return lines;
}
