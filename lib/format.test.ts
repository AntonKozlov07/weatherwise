import { describe, expect, it } from "vitest";

import {
  aqiSeverity,
  formatDayName,
  formatHour,
  formatLongDate,
  formatTemperature,
  formatUpdatedAgo,
  formatWind,
  humidityLabel,
  uvSeverity,
} from "./format";

const TZ = "America/Toronto";
/** 2026-07-28T18:00:00Z, which is 2pm in Toronto. */
const AFTERNOON = Date.UTC(2026, 6, 28, 18, 0);

describe("formatHour", () => {
  // en-CA renders the period as "p.m.", which would otherwise reach the card as
  // "2P.M." once the label style uppercases it.
  it("renders a compact lowercase hour with no dots or spaces", () => {
    expect(formatHour(AFTERNOON, TZ)).toBe("2pm");
    expect(formatHour(Date.UTC(2026, 6, 28, 11, 0), TZ)).toBe("7am");
    expect(formatHour(Date.UTC(2026, 6, 28, 4, 0), TZ)).toBe("12am");
  });

  it("reads in the location's zone, not the device's", () => {
    expect(formatHour(AFTERNOON, "Europe/Berlin")).toBe("8pm");
  });
});

describe("formatDayName", () => {
  it("names today rather than its weekday", () => {
    expect(formatDayName(AFTERNOON, TZ, AFTERNOON)).toBe("Today");
  });

  it("names other days by weekday", () => {
    expect(formatDayName(AFTERNOON + 86_400_000, TZ, AFTERNOON)).toBe(
      "Wednesday",
    );
  });

  // 8pm in Toronto is already the next day in Berlin, so the comparison has to
  // happen in the location's zone.
  it("compares days in the location's zone", () => {
    expect(formatDayName(AFTERNOON, "Australia/Sydney", AFTERNOON)).toBe(
      "Today",
    );
  });
});

describe("formatLongDate", () => {
  it("matches the Figma's date line", () => {
    expect(formatLongDate(AFTERNOON, TZ)).toBe("July 28");
  });
});

describe("formatTemperature and formatWind", () => {
  it("rounds and drops the unit, which is a separate span", () => {
    expect(formatTemperature(17.4)).toBe("17");
    expect(formatTemperature(-1.6)).toBe("-2");
  });

  // Math.round(-0.4) is negative zero, which must not reach the screen as "-0".
  it("never renders a negative zero", () => {
    expect(formatTemperature(-0.4)).toBe("0");
  });

  it("converts when imperial is asked for", () => {
    expect(formatTemperature(0, "imperial")).toBe("32");
    expect(formatTemperature(100, "imperial")).toBe("212");
    expect(formatWind(100, "imperial")).toBe("62 mph");
  });

  it("defaults to metric", () => {
    expect(formatTemperature(21)).toBe("21");
    expect(formatWind(25)).toBe("25 km/h");
  });
});

describe("formatUpdatedAgo", () => {
  it("reads in plain language and never goes negative on clock skew", () => {
    const now = AFTERNOON;

    expect(formatUpdatedAgo(now, now)).toBe("Updated just now");
    expect(formatUpdatedAgo(now - 12 * 60_000, now)).toBe("Updated 12m ago");
    expect(formatUpdatedAgo(now - 2 * 3_600_000, now)).toBe("Updated 2h ago");
    expect(formatUpdatedAgo(now + 60_000, now)).toBe("Updated just now");
  });
});

describe("severity labels", () => {
  // These have to agree with the Guide page copy, which states the same bands.
  it("bands UV the way the Guide describes", () => {
    expect(uvSeverity(2)).toBe("Low");
    expect(uvSeverity(3)).toBe("Moderate");
    expect(uvSeverity(8)).toBe("Very high");
    expect(uvSeverity(11)).toBe("Extreme");
  });

  it("maps the EPA index, which is 1 to 6 rather than an AQI number", () => {
    expect(aqiSeverity(1)).toBe("Good");
    expect(aqiSeverity(6)).toBe("Hazardous");
    expect(aqiSeverity(0)).toBe("Unknown");
    expect(aqiSeverity(7)).toBe("Unknown");
  });

  it("phrases humidity the way the Figma does", () => {
    expect(humidityLabel(30)).toBe("Low");
    expect(humidityLabel(55)).toBe("Low-Moderate");
    expect(humidityLabel(80)).toBe("High");
  });
});
