import { describe, expect, it } from "vitest";

import { buildNowcast, intensityOf } from "./nowcast";
import type { MinutelyPoint } from "./types";

const START = Date.UTC(2026, 6, 28, 18, 0);

/** Sixty minutes from a list of mm/h rates. */
function minutes(rates: number[]): MinutelyPoint[] {
  return rates.map((precipitation, index) => ({
    time: START + index * 60_000,
    precipitation,
  }));
}

const dry = (count: number) => new Array(count).fill(0);
const wet = (count: number, rate = 1) => new Array(count).fill(rate);

describe("intensityOf", () => {
  it("is zero below the noise threshold", () => {
    expect(intensityOf(0)).toBe(0);
    // 0.05 mm/h is reporting noise, not rain anyone notices.
    expect(intensityOf(0.05)).toBe(0);
  });

  it("rises with rate and never exceeds one", () => {
    expect(intensityOf(0.5)).toBeGreaterThan(0);
    expect(intensityOf(5)).toBeGreaterThan(intensityOf(0.5));
    expect(intensityOf(100)).toBe(1);
  });

  // Square-rooted, so a drizzle is still visible rather than a 1px stub.
  it("gives a drizzle a readable share of the height", () => {
    expect(intensityOf(0.5)).toBeGreaterThan(0.15);
  });
});

describe("buildNowcast", () => {
  it("returns null when the region has no minutely data", () => {
    expect(buildNowcast(null)).toBeNull();
    expect(buildNowcast([])).toBeNull();
  });

  it("says nothing is coming when the hour is dry", () => {
    const nowcast = buildNowcast(minutes(dry(60)));

    expect(nowcast?.headline).toBe("No rain expected in the next hour");
    expect(nowcast?.hasPrecipitation).toBe(false);
  });

  /**
   * The transition search is the point of this module. Checking only the first
   * value would report "no rain expected" while a downpour arrives in fourteen
   * minutes.
   */
  it("finds rain starting later in the hour", () => {
    const nowcast = buildNowcast(minutes([...dry(14), ...wet(46)]));

    expect(nowcast?.headline).toBe("Rain starting in 14 min");
    expect(nowcast?.hasPrecipitation).toBe(true);
  });

  it("finds rain stopping when it is already raining", () => {
    expect(buildNowcast(minutes([...wet(8), ...dry(52)]))?.headline).toBe(
      "Rain stopping in 8 min",
    );
  });

  it("reports rain lasting the whole hour", () => {
    expect(buildNowcast(minutes(wet(60)))?.headline).toBe("Rain for the next hour");
  });

  // The headline names the intensity that is arriving, not the intensity now.
  it("names the intensity of the rain that is coming", () => {
    expect(buildNowcast(minutes([...dry(10), ...wet(50, 9)]))?.headline).toBe(
      "Downpour starting in 10 min",
    );
    expect(buildNowcast(minutes([...dry(10), ...wet(50, 0.3)]))?.headline).toBe(
      "Light rain starting in 10 min",
    );
  });

  it("bands a continuous hour by its heaviest rate", () => {
    expect(buildNowcast(minutes(wet(60, 0.3)))?.headline).toBe(
      "Light rain for the next hour",
    );
    expect(buildNowcast(minutes(wet(60, 5)))?.headline).toBe(
      "Heavy rain for the next hour",
    );
  });

  // A trace reading must not trigger "rain starting in 3 minutes".
  it("ignores traces below the noise threshold", () => {
    const nowcast = buildNowcast(minutes([...dry(3), 0.02, ...dry(56)]));

    expect(nowcast?.headline).toBe("No rain expected in the next hour");
    expect(nowcast?.hasPrecipitation).toBe(false);
  });

  it("reports the peak for scaling the chart", () => {
    expect(buildNowcast(minutes([...dry(30), ...wet(30, 4)]))?.peak).toBe(4);
  });

  it("copes with a shorter series than the usual sixty", () => {
    const nowcast = buildNowcast(minutes([...dry(2), ...wet(3)]));

    expect(nowcast?.headline).toBe("Rain starting in 2 min");
    expect(nowcast?.points).toHaveLength(5);
  });
});
