import { describe, expect, it } from "vitest";

import { resolveWindow } from "./windows";

const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

/** A long summer day: sunrise 06:00, sunset 21:00. */
const SUNRISE = Date.UTC(2026, 6, 28, 6, 0);
const SUNSET = Date.UTC(2026, 6, 28, 21, 0);

function at(hours: number, minutes = 0): number {
  return Date.UTC(2026, 6, 28, hours, minutes);
}

describe("resolveWindow", () => {
  it("opens dawn 90 minutes before sunrise", () => {
    expect(resolveWindow(at(4, 30), SUNRISE, SUNSET)).toMatchObject({
      window: "dawn",
      fraction: 0,
    });
  });

  it("is still dawn at sunrise, which is not the end of the window", () => {
    expect(resolveWindow(SUNRISE, SUNRISE, SUNSET).window).toBe("dawn");
  });

  it("hands over to morning 45 minutes after sunrise", () => {
    expect(resolveWindow(at(6, 45), SUNRISE, SUNSET).window).toBe("morning");
  });

  it("ends morning at the midpoint of sunrise and solar noon", () => {
    // Solar noon is 13:30, so the midpoint is 09:45.
    expect(resolveWindow(at(9, 44), SUNRISE, SUNSET).window).toBe("morning");
    expect(resolveWindow(at(9, 46), SUNRISE, SUNSET).window).toBe("midday");
  });

  it("ends midday 150 minutes before sunset", () => {
    expect(resolveWindow(at(18, 29), SUNRISE, SUNSET).window).toBe("midday");
    expect(resolveWindow(at(18, 31), SUNRISE, SUNSET).window).toBe(
      "goldenHour",
    );
  });

  it("ends golden hour 15 minutes after sunset and dusk 90 minutes after", () => {
    expect(resolveWindow(at(21, 10), SUNRISE, SUNSET).window).toBe(
      "goldenHour",
    );
    expect(resolveWindow(at(21, 20), SUNRISE, SUNSET).window).toBe("dusk");
    expect(resolveWindow(at(22, 40), SUNRISE, SUNSET).window).toBe("night");
  });

  it("runs the fraction from 0 to 1 across a window", () => {
    // Dawn spans 04:30 to 06:45, so 05:37:30 is the midpoint.
    const middle = resolveWindow(at(5, 37) + 30_000, SUNRISE, SUNSET);

    expect(middle.window).toBe("dawn");
    expect(middle.fraction).toBeCloseTo(0.5, 3);
  });

  it("always names the window it is blending toward", () => {
    expect(resolveWindow(at(12), SUNRISE, SUNSET).next).toBe("goldenHour");
    expect(resolveWindow(at(23), SUNRISE, SUNSET).next).toBe("dawn");
  });

  // After midnight the night in progress started before the sunrise we were
  // given, so it has to be shifted back a day rather than read as a gap.
  it("treats the small hours as the tail of the previous night", () => {
    const small = resolveWindow(at(2), SUNRISE, SUNSET);

    expect(small.window).toBe("night");
    expect(small.next).toBe("dawn");
    expect(small.fraction).toBeGreaterThan(0.5);
    expect(small.fraction).toBeLessThan(1);
  });

  it("keeps night continuous across midnight", () => {
    const before = resolveWindow(at(23, 59), SUNRISE, SUNSET);
    const after = resolveWindow(at(23, 59) + 2 * MINUTE, SUNRISE, SUNSET);

    expect(before.window).toBe("night");
    expect(after.window).toBe("night");
    // 00:01 the next day is later in the same night, so it must not jump back.
    expect(after.fraction).toBeGreaterThan(before.fraction);
  });

  it("never returns a fraction outside 0 to 1", () => {
    for (let minute = 0; minute < 24 * 60; minute += 7) {
      const { fraction } = resolveWindow(
        at(0) + minute * MINUTE,
        SUNRISE,
        SUNSET,
      );

      expect(fraction).toBeGreaterThanOrEqual(0);
      expect(fraction).toBeLessThanOrEqual(1);
    }
  });

  // A two hour polar winter day puts sunset - 150min before sunrise + 45min.
  describe("degenerate days", () => {
    const shortSunrise = Date.UTC(2026, 0, 15, 11, 0);
    const shortSunset = Date.UTC(2026, 0, 15, 13, 0);

    it("collapses squeezed windows instead of producing a negative span", () => {
      for (let minute = 0; minute < 24 * 60; minute += 5) {
        const { fraction } = resolveWindow(
          Date.UTC(2026, 0, 15) + minute * MINUTE,
          shortSunrise,
          shortSunset,
        );

        expect(Number.isFinite(fraction)).toBe(true);
        expect(fraction).toBeGreaterThanOrEqual(0);
        expect(fraction).toBeLessThanOrEqual(1);
      }
    });

    it("still reaches night after dusk", () => {
      expect(
        resolveWindow(
          shortSunset + 2 * HOUR,
          shortSunrise,
          shortSunset,
        ).window,
      ).toBe("night");
    });
  });

  it("falls back to the end of night when the anchors are over a day stale", () => {
    expect(resolveWindow(at(12) + 3 * DAY, SUNRISE, SUNSET)).toEqual({
      window: "night",
      next: "dawn",
      fraction: 1,
    });
  });
});
