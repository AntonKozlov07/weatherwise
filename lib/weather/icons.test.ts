import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { allIconNames, weatherIconName, weatherIconSrc } from "./icons";
import type { ConditionRef } from "./types";

const ICON_DIR = path.resolve(__dirname, "../../public/weather-icons");

function condition(
  system: ConditionRef["system"],
  code: number,
  isDay = true,
): ConditionRef {
  return { system, code, text: "", isDay };
}

describe("weatherIconName", () => {
  it("picks the day or night variant where one exists", () => {
    expect(weatherIconName(condition("weatherapi", 1000, true))).toBe(
      "clear-day",
    );
    expect(weatherIconName(condition("weatherapi", 1000, false))).toBe(
      "clear-night",
    );
  });

  it("inserts the variant before a trailing modifier, as Meteocons names them", () => {
    expect(weatherIconName(condition("weatherapi", 1240, true))).toBe(
      "partly-cloudy-day-rain",
    );
    expect(weatherIconName(condition("weatherapi", 1276, false))).toBe(
      "thunderstorms-night-rain",
    );
  });

  it("leaves icons without a night form alone", () => {
    expect(weatherIconName(condition("weatherapi", 1189, false))).toBe("rain");
    expect(weatherIconName(condition("weatherapi", 1009, false))).toBe(
      "overcast-night",
    );
  });

  it("reads WMO codes from the other table", () => {
    expect(weatherIconName(condition("wmo", 3))).toBe("overcast-day");
    expect(weatherIconName(condition("wmo", 95))).toBe(
      "thunderstorms-day-rain",
    );
  });

  it("falls back rather than producing a broken image src", () => {
    expect(weatherIconName(condition("weatherapi", 9999))).toBe(
      "not-available",
    );
    expect(weatherIconSrc(condition("wmo", -1))).toBe(
      "/weather-icons/not-available.svg",
    );
  });
});

describe("icon files", () => {
  // The mapping is written by hand against the Meteocons file listing, so a
  // typo would only ever show up as a missing image at runtime.
  it("has a real file for every name the mapping can produce", () => {
    const missing = allIconNames().filter(
      (name) => !existsSync(path.join(ICON_DIR, `${name}.svg`)),
    );

    expect(missing).toEqual([]);
  });
});
