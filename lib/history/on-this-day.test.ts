import { describe, expect, it } from "vitest";

import { compareToday, historyFacts, summarise } from "./on-this-day";
import type { DayRecord } from "./on-this-day";

const years: DayRecord[] = [
  { year: 2020, high: 24, low: 14, precipitation: 0 },
  { year: 2021, high: 31, low: 19, precipitation: 2 },
  { year: 2022, high: 19, low: 8, precipitation: 18 },
  { year: 2023, high: 26, low: 15, precipitation: 0 },
  { year: 2024, high: 22, low: 11, precipitation: 4 },
];

describe("summarise", () => {
  it("finds the extremes and the span", () => {
    const history = summarise(years)!;

    expect(history.hottest.year).toBe(2021);
    expect(history.coldest.year).toBe(2022);
    expect(history.wettest.year).toBe(2022);
    expect(history.span).toEqual({ from: 2020, to: 2024 });
  });

  it("averages the highs and lows", () => {
    const history = summarise(years)!;

    expect(history.averageHigh).toBeCloseTo(24.4, 1);
    expect(history.averageLow).toBeCloseTo(13.4, 1);
  });

  it("returns null rather than inventing a record from nothing", () => {
    expect(summarise([])).toBeNull();
  });

  it("copes with a single year", () => {
    const history = summarise([years[0]])!;

    expect(history.hottest.year).toBe(2020);
    expect(history.coldest.year).toBe(2020);
    expect(history.span).toEqual({ from: 2020, to: 2020 });
  });
});

describe("compareToday", () => {
  const history = summarise(years)!;

  it("measures today against the historical mean", () => {
    expect(compareToday(history, 27, 16).versusAverage).toBeCloseTo(2.6, 1);
    expect(compareToday(history, 20, 10).versusAverage).toBeCloseTo(-4.4, 1);
  });

  it("recognises a record on either end", () => {
    expect(compareToday(history, 33, 20).isRecord).toBe("hottest");
    expect(compareToday(history, 10, 5).isRecord).toBe("coldest");
    expect(compareToday(history, 25, 14).isRecord).toBeNull();
  });

  // Equalling the record is not beating it.
  it("does not call a tie a record", () => {
    expect(compareToday(history, 31, 20).isRecord).toBeNull();
  });

  it("counts how many years today beats", () => {
    const comparison = compareToday(history, 25, 14);

    expect(comparison.warmerThan).toBe(3);
    expect(comparison.totalYears).toBe(5);
  });
});

describe("historyFacts", () => {
  const history = summarise(years)!;

  it("leads with a record when today would set one", () => {
    const facts = historyFacts(history, compareToday(history, 33, 20));

    expect(facts[0]).toMatch(/hottest this date has been since 2020/);
  });

  it("always states the extremes, record or not", () => {
    const facts = historyFacts(history, compareToday(history, 25, 14));

    expect(facts.join(" ")).toContain("31° in 2021");
    expect(facts.join(" ")).toContain("8° in 2022");
  });

  // A trace of rain is not the wettest anything, and saying so is noise.
  it("omits the wettest year when nothing meaningful fell", () => {
    const dry = summarise(years.map((year) => ({ ...year, precipitation: 0 })))!;
    const facts = historyFacts(dry, null);

    expect(facts.join(" ")).not.toMatch(/wettest/);
  });

  it("mentions the departure from average only when it is worth mentioning", () => {
    const close = historyFacts(history, compareToday(history, 24.6, 13));
    const far = historyFacts(history, compareToday(history, 30, 18));

    expect(close.join(" ")).not.toMatch(/warmer than this date usually/);
    expect(far.join(" ")).toMatch(/warmer than this date usually/);
  });

  it("works with no forecast to compare against", () => {
    const facts = historyFacts(history, null);

    expect(facts.length).toBeGreaterThan(0);
    expect(facts.join(" ")).toContain("2021");
  });
});
