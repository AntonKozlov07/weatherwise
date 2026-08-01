/**
 * On this day, from the 1940 archive.
 *
 * Everything here is computed from observed data. Nothing is recalled, inferred
 * or written by a model, which is what makes it safe to state as fact: a record
 * that comes out of an arithmetic pass over real measurements cannot be a
 * plausible invention (Decisions Log 103).
 *
 * The archive is queried for this calendar day across every available year, so
 * the comparison is like for like: today against every other version of today,
 * not against an annual average that includes January.
 */

export type DayRecord = {
  year: number;
  high: number;
  low: number;
  precipitation: number;
};

export type OnThisDay = {
  /** Every year the archive returned for this calendar day. */
  years: DayRecord[];
  hottest: DayRecord;
  coldest: DayRecord;
  wettest: DayRecord;
  /** Mean high across all years, for "warmer than usual". */
  averageHigh: number;
  averageLow: number;
  span: { from: number; to: number };
};

/**
 * How today compares. Null where there is no forecast to compare against, which
 * is not a failure: the records stand on their own.
 */
export type TodayComparison = {
  /** Degrees above or below the historical mean high. */
  versusAverage: number;
  /** True if today would be the hottest or coldest on record for this day. */
  isRecord: "hottest" | "coldest" | null;
  /** How many of the recorded years were cooler than today. */
  warmerThan: number;
  totalYears: number;
};

export function summarise(records: DayRecord[]): OnThisDay | null {
  if (records.length === 0) return null;

  const years = [...records].sort((a, b) => a.year - b.year);

  const hottest = years.reduce((best, year) => (year.high > best.high ? year : best));
  const coldest = years.reduce((best, year) => (year.low < best.low ? year : best));
  const wettest = years.reduce((best, year) =>
    year.precipitation > best.precipitation ? year : best,
  );

  const mean = (pick: (record: DayRecord) => number) =>
    Math.round((years.reduce((sum, year) => sum + pick(year), 0) / years.length) * 10) /
    10;

  return {
    years,
    hottest,
    coldest,
    wettest,
    averageHigh: mean((year) => year.high),
    averageLow: mean((year) => year.low),
    span: { from: years[0].year, to: years[years.length - 1].year },
  };
}

export function compareToday(
  history: OnThisDay,
  todayHigh: number,
  todayLow: number,
): TodayComparison {
  const warmerThan = history.years.filter((year) => year.high < todayHigh).length;

  return {
    versusAverage: Math.round((todayHigh - history.averageHigh) * 10) / 10,
    isRecord:
      todayHigh > history.hottest.high
        ? "hottest"
        : todayLow < history.coldest.low
          ? "coldest"
          : null,
    warmerThan,
    totalYears: history.years.length,
  };
}

/**
 * Facts worth stating, in the order they deserve attention.
 *
 * Returned as sentences rather than numbers because the caller has no better
 * idea than this module which of them is interesting. A record today outranks a
 * record from 1974, which outranks an average.
 */
export function historyFacts(
  history: OnThisDay,
  comparison: TodayComparison | null,
): string[] {
  const facts: string[] = [];

  if (comparison?.isRecord === "hottest") {
    facts.push(
      `Today would be the hottest this date has been since ${history.span.from}.`,
    );
  } else if (comparison?.isRecord === "coldest") {
    facts.push(
      `Today would be the coldest this date has been since ${history.span.from}.`,
    );
  }

  facts.push(
    `The hottest this date has been was ${Math.round(history.hottest.high)}° in ${history.hottest.year}.`,
  );
  facts.push(
    `The coldest was ${Math.round(history.coldest.low)}° in ${history.coldest.year}.`,
  );

  if (history.wettest.precipitation >= 1) {
    facts.push(
      `The wettest was ${history.wettest.year}, with ${Math.round(history.wettest.precipitation)} mm.`,
    );
  }

  if (comparison && Math.abs(comparison.versusAverage) >= 1) {
    const warmer = comparison.versusAverage > 0;
    facts.push(
      `Today is ${Math.abs(comparison.versusAverage)}° ${warmer ? "warmer" : "cooler"} than this date usually is.`,
    );
  }

  return facts;
}
