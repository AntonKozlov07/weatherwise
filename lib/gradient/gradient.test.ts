import { describe, expect, it } from "vitest";

import { conditionInfo } from "@/lib/weather/openweather/conditions";

import { getGreetingGradient } from "./index";
import { hexToOklch } from "./oklch";
import { BASE_STOPS } from "./windows";

const SUNRISE = new Date(Date.UTC(2026, 6, 28, 6, 0));
const SUNSET = new Date(Date.UTC(2026, 6, 28, 21, 0));

const CLEAR = 800;

function at(hours: number, minutes = 0): Date {
  return new Date(Date.UTC(2026, 6, 28, hours, minutes));
}

function gradientAt(hours: number, minutes = 0, code = CLEAR) {
  return getGreetingGradient(at(hours, minutes), SUNRISE, SUNSET, code);
}

/** Shortest angular distance between two hues, in degrees. */
function hueDistance(a: number, b: number): number {
  return Math.abs(((b - a + 540) % 360) - 180);
}

/** Whether `after` sits closer to `target`'s hue than `before` did. */
function movesToward(before: string, after: string, target: string): boolean {
  const targetHue = hexToOklch(target).h;

  return (
    hueDistance(hexToOklch(after).h, targetHue) <
    hueDistance(hexToOklch(before).h, targetHue)
  );
}

describe("conditionBucket", () => {
  it("maps each documented family", () => {
    expect(conditionInfo(800).bucket).toBe("clear");
    expect(conditionInfo(802).bucket).toBe("partlyCloudy");
    expect(conditionInfo(804).bucket).toBe("overcast");
    expect(conditionInfo(501).bucket).toBe("rain");
    expect(conditionInfo(601).bucket).toBe("snow");
    expect(conditionInfo(200).bucket).toBe("thunderstorm");
    expect(conditionInfo(741).bucket).toBe("fog");
  });

  it("falls back to clear for unknown codes, leaving the time of day undiluted", () => {
    expect(conditionInfo(4242).bucket).toBe("clear");
  });
});

describe("getGreetingGradient", () => {
  it("returns the window's base stops at its very start on a clear day", () => {
    // Dawn opens at 04:30 with fraction 0, so no blending has happened yet.
    const gradient = gradientAt(4, 30);

    expect(gradient.from.toUpperCase()).toBe(BASE_STOPS.dawn.from);
    expect(gradient.to.toUpperCase()).toBe(BASE_STOPS.dawn.to);
  });

  it("has fully become the next window's stops by the handover", () => {
    // Dawn ends at 06:45, where it should have reached morning's stops, and
    // morning begins there at fraction 0 with those same stops.
    const endOfDawn = gradientAt(6, 44, CLEAR);
    const startOfMorning = gradientAt(6, 46, CLEAR);

    expect(hexToOklch(endOfDawn.from).l).toBeCloseTo(
      hexToOklch(startOfMorning.from).l,
      2,
    );
    expect(hexToOklch(endOfDawn.to).l).toBeCloseTo(
      hexToOklch(startOfMorning.to).l,
      2,
    );
  });

  // The spec is explicit that nothing snaps at a boundary.
  it("never jumps between consecutive minutes across a whole day", () => {
    let previous = gradientAt(0, 0);

    for (let minute = 1; minute < 24 * 60; minute += 1) {
      const current = getGreetingGradient(
        new Date(Date.UTC(2026, 6, 28, 0, minute)),
        SUNRISE,
        SUNSET,
        CLEAR,
      );

      for (const stop of ["from", "to"] as const) {
        const before = hexToOklch(previous[stop]);
        const after = hexToOklch(current[stop]);

        // A minute is a small share of the shortest window, so no step should
        // move perceptual lightness by more than a couple of percent.
        expect(Math.abs(after.l - before.l)).toBeLessThan(0.03);
      }

      previous = current;
    }
  });

  it("leaves a clear sky untinted", () => {
    const clear = gradientAt(12, 0, 800);
    const partly = gradientAt(12, 0, 802);

    expect(clear).not.toEqual(partly);
    expect(hexToOklch(clear.from).c).toBeGreaterThan(
      hexToOklch(partly.from).c,
    );
  });

  it("drains chroma for partly cloudy and drains it further for overcast", () => {
    const clear = hexToOklch(gradientAt(12, 0, 800).from).c;
    const partly = hexToOklch(gradientAt(12, 0, 802).from).c;
    const overcast = hexToOklch(gradientAt(12, 0, 804).from).c;

    expect(partly).toBeLessThan(clear);
    expect(overcast).toBeLessThan(partly);
  });

  it("pulls rain toward slate blue and snow toward pale ice", () => {
    expect(movesToward(gradientAt(12).from, gradientAt(12, 0, 501).from, "#5B7A99")).toBe(true);
    expect(movesToward(gradientAt(12).from, gradientAt(12, 0, 601).from, "#D9E8F5")).toBe(true);
  });

  // Blending takes the short way round the hue circle, so midday amber reaches
  // violet by way of orange and magenta rather than by climbing through blue.
  // The test asserts it gets closer to violet, not which side it approaches from.
  it("pushes a thunderstorm violet", () => {
    expect(movesToward(gradientAt(12).from, gradientAt(12, 0, 200).from, "#6B5BA8")).toBe(true);
  });

  it("flattens the lightness difference between stops in fog", () => {
    const clear = gradientAt(12);
    const fog = gradientAt(12, 0, 741);

    const clearDelta = Math.abs(
      hexToOklch(clear.from).l - hexToOklch(clear.to).l,
    );
    const fogDelta = Math.abs(hexToOklch(fog.from).l - hexToOklch(fog.to).l);

    expect(fogDelta).toBeLessThan(clearDelta);
  });

  it("always returns two parseable hex colours", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      for (const code of [800, 802, 804, 501, 601, 200, 741, 9999]) {
        const gradient = gradientAt(hour, 0, code);

        expect(gradient.from).toMatch(/^#[0-9a-f]{6}$/);
        expect(gradient.to).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });
});
