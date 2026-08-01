import { describe, expect, it } from "vitest";

import { compareForecasts } from "./compare";
import type { OpenMeteoForecast } from "./client";
import type { HourlyPoint } from "@/lib/weather/types";

const TZ = "America/Toronto";
const HOUR = 3_600_000;
/** 2026-08-01T14:00Z, which is 10:00 in Toronto. */
const START = Date.UTC(2026, 7, 1, 14, 0);

function ours(temps: number[], chances: number[] = []): HourlyPoint[] {
  return temps.map((temperature, index) => ({
    time: START + index * HOUR,
    condition: { code: 800, label: "Clear", isDay: true },
    temperature,
    feelsLike: temperature,
    precipitationChance: chances[index] ?? 0,
    precipitation: 0,
    humidity: 50,
    uvIndex: 3,
    wind: { speed: 10, gust: 12, direction: 270, compass: "W" },
  }));
}

/** Local ISO stamps, the way Open-Meteo returns them under timezone=auto. */
function theirs(temps: number[], chances: number[] = []): OpenMeteoForecast {
  const time = temps.map((_, index) => {
    const at = new Date(START + index * HOUR);
    const local = new Intl.DateTimeFormat("en-CA", {
      timeZone: TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
    }).formatToParts(at);
    const get = (type: string) => local.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour").padStart(2, "0")}:00`;
  });

  return {
    time,
    temperature: temps,
    precipitationChance: temps.map((_, index) => chances[index] ?? 0),
    precipitation: temps.map(() => 0),
  };
}

const flat = (value: number, count = 12) => new Array(count).fill(value);

describe("compareForecasts", () => {
  it("calls close agreement high confidence", () => {
    const result = compareForecasts(ours(flat(20)), theirs(flat(20.4)), TZ);

    expect(result?.confidence).toBe("high");
    expect(result?.temperatureGap).toBeLessThan(1);
    expect(result?.disagreeingHours).toBe(0);
  });

  it("calls a wide temperature gap low confidence", () => {
    const result = compareForecasts(ours(flat(20)), theirs(flat(24.5)), TZ);

    expect(result?.confidence).toBe("low");
    expect(result?.temperatureGap).toBeCloseTo(4.5, 1);
  });

  /**
   * The disagreement that matters most: same temperature, opposite answers on
   * whether it rains. That is the one that changes what someone does.
   */
  it("calls a rain disagreement low confidence even when temperatures match", () => {
    const result = compareForecasts(
      ours(flat(20), flat(80)),
      theirs(flat(20), flat(10)),
      TZ,
    );

    expect(result?.confidence).toBe("low");
    expect(result?.disagreeingHours).toBe(result?.comparedHours);
  });

  it("treats a small gap with no rain dispute as moderate", () => {
    const result = compareForecasts(ours(flat(20)), theirs(flat(22)), TZ);

    expect(result?.confidence).toBe("moderate");
  });

  /**
   * A couple of disputed hours is not "low", but it is not "high" either.
   * High has to mean the two models agreed throughout, or the label says
   * nothing: a day where they differ about whether it rains at breakfast is
   * genuinely less certain than one where they do not.
   */
  it("drops to moderate for even a couple of disputed hours", () => {
    const chancesOurs = [90, 90, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    const chancesTheirs = [10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

    const result = compareForecasts(
      ours(flat(20), chancesOurs),
      theirs(flat(20), chancesTheirs),
      TZ,
    );

    expect(result?.disagreeingHours).toBe(2);
    expect(result?.confidence).toBe("moderate");
  });

  describe("when there is nothing to compare", () => {
    it("returns null without the second forecast", () => {
      expect(compareForecasts(ours(flat(20)), null, TZ)).toBeNull();
    });

    /**
     * Null rather than a guess. The absence of a confidence signal is honest;
     * a fabricated one is worse than none, because it would be believed.
     */
    it("returns null when too few hours overlap", () => {
      const result = compareForecasts(ours(flat(20, 12)), theirs(flat(20, 3)), TZ);

      expect(result).toBeNull();
    });

    it("returns null for an empty primary forecast", () => {
      expect(compareForecasts([], theirs(flat(20)), TZ)).toBeNull();
    });
  });

  it("aligns hours by local clock rather than by index", () => {
    // The second forecast starts three hours later, so only the overlap counts
    // and the offset must not be compared position by position.
    const shifted: OpenMeteoForecast = (() => {
      const full = theirs(flat(20, 12));
      return {
        time: full.time.slice(3),
        temperature: full.temperature.slice(3).map(() => 20),
        precipitationChance: full.precipitationChance.slice(3),
        precipitation: full.precipitation.slice(3),
      };
    })();

    const result = compareForecasts(ours(flat(20, 12)), shifted, TZ);

    expect(result?.comparedHours).toBe(9);
    expect(result?.temperatureGap).toBe(0);
  });
});
