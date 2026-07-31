import { describe, expect, it } from "vitest";

import { nextGoldenHour, uvBand, uvPeak } from "./golden";
import type { Astronomy, HourlyPoint } from "@/lib/weather/types";

const HOUR = 3_600_000;
const NOON = Date.UTC(2026, 6, 28, 12, 0);

const astronomy: Astronomy = {
  sunrise: NOON - 6 * HOUR,
  sunset: NOON + 8 * HOUR,
  moonrise: null,
  moonset: null,
  moonPhase: null,
  moonPhaseLabel: null,
};

function hours(uv: number[], from = NOON): HourlyPoint[] {
  return uv.map((uvIndex, index) => ({
    time: from + index * HOUR,
    condition: { code: 800, label: "Clear", isDay: true },
    temperature: 20,
    feelsLike: 20,
    precipitationChance: 0,
    precipitation: 0,
    humidity: 50,
    uvIndex,
    wind: { speed: 10, gust: 12, direction: 270, compass: "W" },
  }));
}

describe("nextGoldenHour", () => {
  it("offers the evening window during the middle of the day", () => {
    const golden = nextGoldenHour(astronomy, NOON);

    expect(golden?.kind).toBe("sunset");
    expect(golden?.active).toBe(false);
    // The hour before sunset, not the hour after it.
    expect(golden?.end).toBe(astronomy.sunset);
  });

  it("offers the morning window before the sun is up", () => {
    const golden = nextGoldenHour(astronomy, NOON - 8 * HOUR);

    expect(golden?.kind).toBe("sunrise");
    expect(golden?.start).toBe(astronomy.sunrise);
  });

  // Happening now is more useful than happening later, so it takes precedence.
  it("reports the window in progress rather than the next one", () => {
    const golden = nextGoldenHour(astronomy, astronomy.sunrise! + 30 * 60_000);

    expect(golden?.kind).toBe("sunrise");
    expect(golden?.active).toBe(true);
  });

  it("gives nothing once both have passed", () => {
    expect(nextGoldenHour(astronomy, astronomy.sunset! + HOUR)).toBeNull();
  });

  it("copes with a location that reports no sun times", () => {
    const polar = { ...astronomy, sunrise: null, sunset: null };
    expect(nextGoldenHour(polar, NOON)).toBeNull();
  });

  it("still offers sunset where only sunset is known", () => {
    const partial = { ...astronomy, sunrise: null };
    expect(nextGoldenHour(partial, NOON)?.kind).toBe("sunset");
  });
});

describe("uvPeak", () => {
  it("finds the strongest hour and names its band", () => {
    const peak = uvPeak(hours([3, 5, 8, 9, 6, 4, 2]), NOON);

    expect(peak?.index).toBe(9);
    expect(peak?.band).toBe("very high");
    expect(peak?.time).toBe(NOON + 3 * HOUR);
  });

  /**
   * Below 3 there is nothing worth saying, and a line about it would appear on
   * every winter day and most cloudy ones.
   */
  it("says nothing when the sun is weak all day", () => {
    expect(uvPeak(hours([0, 1, 2, 2, 1, 0]), NOON)).toBeNull();
  });

  it("marks a peak that has already passed", () => {
    const peak = uvPeak(hours([9, 6, 4, 2], NOON - HOUR), NOON + 30 * 60_000);

    expect(peak?.past).toBe(true);
  });

  it("returns nothing rather than throwing with no hours", () => {
    expect(uvPeak([], NOON)).toBeNull();
  });

  it("does not reach into tomorrow for a higher reading", () => {
    // A big peak 20 hours out is a different day and not this line's business.
    const peak = uvPeak(hours([4, 3, 3, ...new Array(18).fill(1), 11]), NOON);

    expect(peak?.index).toBe(4);
  });
});

describe("uvBand", () => {
  it("matches the published thresholds at every boundary", () => {
    expect(uvBand(2.9)).toBe("low");
    expect(uvBand(3)).toBe("moderate");
    expect(uvBand(6)).toBe("high");
    expect(uvBand(8)).toBe("very high");
    expect(uvBand(11)).toBe("extreme");
  });
});
