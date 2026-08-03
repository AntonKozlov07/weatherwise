import { describe, expect, it } from "vitest";

import { accuracySummary, measureAccuracy, type DayPair } from "./accuracy";

/** A run of days with a given signed error on the high. */
function pairs(errors: number[]): DayPair[] {
  return errors.map((error, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    forecastHigh: 20 + error,
    forecastLow: 10,
    actualHigh: 20,
    actualLow: 10,
  }));
}

describe("measureAccuracy", () => {
  it("averages the absolute error, not the signed one", () => {
    // Perfectly symmetric: the mean error is 2, the bias is 0.
    const result = measureAccuracy(pairs([2, -2, 2, -2, 2, -2, 2, -2]))!;

    expect(result.highError).toBe(2);
    expect(result.highBias).toBe(0);
  });

  it("reports a consistent lean as bias", () => {
    const result = measureAccuracy(pairs([2, 3, 2, 2, 3, 2, 3, 3]))!;

    expect(result.highBias).toBeGreaterThan(2);
    expect(result.highError).toBe(result.highBias);
  });

  it("counts the days that landed close enough to ignore", () => {
    const result = measureAccuracy(pairs([0, 1, 1.5, 4, 0, 0, 5, 1]))!;

    // Six of eight are within 1.5.
    expect(result.withinTolerance).toBe(75);
  });

  it("keeps the worst miss rather than smoothing it away", () => {
    const result = measureAccuracy(pairs([0, 0, 0, 0, 0, 0, 0, -7]))!;

    expect(result.worst?.error).toBe(-7);
    expect(result.worst?.date).toBe("2026-07-08");
  });

  /**
   * A confident number from four days would be worse than no number: it would
   * be believed, and it would be noise.
   */
  it("refuses to measure too small a sample", () => {
    expect(measureAccuracy(pairs([1, 1, 1]))).toBeNull();
    expect(measureAccuracy([])).toBeNull();
  });
});

describe("accuracySummary", () => {
  it("names the direction when the forecast leans", () => {
    const warm = accuracySummary(measureAccuracy(pairs(new Array(10).fill(3)))!);

    expect(warm.join(" ")).toMatch(/leans warm/);
    expect(warm.join(" ")).toMatch(/expect a little cooler/);
  });

  // Scatter around zero is not actionable, and a signed average of 0.1 stated
  // as a lean would be a meaningless number given authority.
  it("says so plainly when there is no lean to report", () => {
    const even = accuracySummary(
      measureAccuracy(pairs([2, -2, 2, -2, 2, -2, 2, -2]))!,
    );

    expect(even.join(" ")).toMatch(/both directions/);
    expect(even.join(" ")).not.toMatch(/leans/);
  });

  it("mentions the worst miss only when it was genuinely bad", () => {
    const mild = accuracySummary(measureAccuracy(pairs(new Array(10).fill(1)))!);
    const bad = accuracySummary(
      measureAccuracy(pairs([1, 1, 1, 1, 1, 1, 1, 1, 1, 9]))!,
    );

    expect(mild.join(" ")).not.toMatch(/worst miss/);
    expect(bad.join(" ")).toMatch(/worst miss/);
  });
});
