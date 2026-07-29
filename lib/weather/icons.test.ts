import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { allIconNames, weatherIconName, weatherIconSrc } from "./icons";
import { ALL_CONDITION_CODES } from "./openweather/conditions";
import type { ConditionRef } from "./types";

const ICON_DIR = path.resolve(__dirname, "../../public/weather-icons");

function condition(code: number, isDay = true): ConditionRef {
  return { code, label: "", isDay };
}

describe("weatherIconName", () => {
  it("picks the day or night variant where one exists", () => {
    expect(weatherIconName(condition(800, true))).toBe("clear-day");
    expect(weatherIconName(condition(800, false))).toBe("clear-night");
  });

  it("inserts the variant before a trailing modifier, as Meteocons names them", () => {
    expect(weatherIconName(condition(500, true))).toBe("partly-cloudy-day-rain");
    expect(weatherIconName(condition(200, false))).toBe(
      "thunderstorms-night-rain",
    );
  });

  it("leaves icons without a night form alone", () => {
    expect(weatherIconName(condition(501, false))).toBe("rain");
    expect(weatherIconName(condition(601, false))).toBe("snow");
  });

  it("resolves overcast, which does have a night form", () => {
    expect(weatherIconName(condition(804, false))).toBe("overcast-night");
  });

  it("falls back by group rather than producing a broken src", () => {
    // 5xx is rain, so an unlisted 5xx code still lands on a rain icon.
    expect(weatherIconSrc(condition(599))).toBe("/weather-icons/rain.svg");
    // An entirely unknown code reads as clear, which is the honest default.
    expect(weatherIconSrc(condition(1234, true))).toBe(
      "/weather-icons/clear-day.svg",
    );
  });
});

describe("icon files", () => {
  // The mapping is written by hand against the Meteocons listing, so a typo
  // would only ever show up as a missing image at runtime.
  it("has a real file for every name the mapping can produce", () => {
    const missing = allIconNames(ALL_CONDITION_CODES).filter(
      (name) => !existsSync(path.join(ICON_DIR, `${name}.svg`)),
    );

    expect(missing).toEqual([]);
  });
});
