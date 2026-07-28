import { describe, expect, it } from "vitest";

import { LOCAL_MIDNIGHT_SECONDS, openMeteoFixture, weatherApiFixture } from "./fixtures";
import {
  degreesToCompass,
  normalizeAirQuality,
  normalizeAlerts,
  normalizeAstronomy,
  normalizeCurrent,
  normalizeDaily,
  normalizeHourly,
  normalizeLocation,
} from "./normalize";

const MIDNIGHT_MS = LOCAL_MIDNIGHT_SECONDS * 1000;
const HOUR_MS = 3_600_000;

describe("degreesToCompass", () => {
  it("maps the cardinals", () => {
    expect(degreesToCompass(0)).toBe("N");
    expect(degreesToCompass(90)).toBe("E");
    expect(degreesToCompass(180)).toBe("S");
    expect(degreesToCompass(270)).toBe("W");
  });

  it("wraps past 360 and below zero instead of falling off the table", () => {
    expect(degreesToCompass(359)).toBe("N");
    expect(degreesToCompass(360)).toBe("N");
    expect(degreesToCompass(-45)).toBe("NW");
  });
});

describe("normalizeCurrent", () => {
  it("converts the observation time from seconds to milliseconds", () => {
    const current = normalizeCurrent(weatherApiFixture().current);
    expect(current.observedAt).toBe(MIDNIGHT_MS + 14 * HOUR_MS);
  });

  it("tags the condition with the system that produced the code", () => {
    const current = normalizeCurrent(weatherApiFixture().current);
    expect(current.condition).toEqual({
      system: "weatherapi",
      code: 1000,
      text: "Sunny",
      isDay: true,
    });
  });

  it("carries gusts through when the vendor reported them", () => {
    const current = normalizeCurrent(weatherApiFixture().current);
    expect(current.wind).toEqual({
      speed: 25,
      gust: 38,
      direction: 315,
      compass: "NW",
    });
  });

  it("reports a missing gust as null rather than zero", () => {
    const raw = weatherApiFixture();
    delete raw.current.gust_kph;

    expect(normalizeCurrent(raw.current).wind.gust).toBeNull();
  });
});

describe("normalizeHourly", () => {
  it("starts at the current hour, not at midnight", () => {
    const now = MIDNIGHT_MS + 14 * HOUR_MS + 20 * 60_000;
    const hourly = normalizeHourly(weatherApiFixture(), now);

    expect(hourly[0]?.time).toBe(MIDNIGHT_MS + 14 * HOUR_MS);
  });

  it("caps at 48 points even though three days were fetched", () => {
    const hourly = normalizeHourly(weatherApiFixture(), MIDNIGHT_MS);
    expect(hourly).toHaveLength(48);
  });

  it("takes the higher of rain and snow chance", () => {
    const raw = weatherApiFixture();
    raw.forecast.forecastday[0].hour[0].chance_of_rain = 10;
    raw.forecast.forecastday[0].hour[0].chance_of_snow = 70;

    const hourly = normalizeHourly(raw, MIDNIGHT_MS);
    expect(hourly[0]?.precipitationChance).toBe(70);
  });
});

describe("normalizeAstronomy", () => {
  it("takes sun times from Open-Meteo as real instants", () => {
    const astronomy = normalizeAstronomy(weatherApiFixture(), openMeteoFixture());

    expect(astronomy.sunrise).toBe(MIDNIGHT_MS + 6 * HOUR_MS + 390_000);
    expect(astronomy.sunset).toBe(MIDNIGHT_MS + 20 * HOUR_MS + 2_903_000);
  });

  it("takes moon data from WeatherAPI and parses string illumination", () => {
    const astronomy = normalizeAstronomy(weatherApiFixture(), openMeteoFixture());

    expect(astronomy.moonPhase).toBe("Waning Gibbous");
    expect(astronomy.moonrise).toBe("10:12 PM");
    expect(astronomy.moonIllumination).toBe(82);
  });

  it("nulls the sun times when Open-Meteo is unavailable", () => {
    const astronomy = normalizeAstronomy(weatherApiFixture(), null);

    expect(astronomy.sunrise).toBeNull();
    expect(astronomy.sunset).toBeNull();
    // Moon data does not depend on Open-Meteo, so it survives.
    expect(astronomy.moonPhase).toBe("Waning Gibbous");
  });
});

describe("normalizeAirQuality", () => {
  it("reads the US EPA index", () => {
    expect(normalizeAirQuality(weatherApiFixture().current)?.epaIndex).toBe(1);
  });

  it("returns null when the plan did not include air quality", () => {
    const raw = weatherApiFixture();
    delete raw.current.air_quality;

    expect(normalizeAirQuality(raw.current)).toBeNull();
  });
});

describe("normalizeAlerts", () => {
  it("is empty when the response carries no alerts block at all", () => {
    expect(normalizeAlerts(weatherApiFixture())).toEqual([]);
  });

  it("builds an id from identifying fields so a dismissal survives a refetch", () => {
    const raw = weatherApiFixture({
      alerts: {
        alert: [
          {
            event: "Severe Thunderstorm Warning",
            headline: "Severe thunderstorm warning in effect",
            severity: "Severe",
            urgency: "Immediate",
            areas: "Wellington",
            desc: "Take shelter.",
            effective: "2026-07-28T18:00:00+00:00",
            expires: "2026-07-28T21:00:00+00:00",
          },
        ],
      },
    });

    const [alert] = normalizeAlerts(raw);

    expect(alert.id).toBe(
      "Severe Thunderstorm Warning|2026-07-28T18:00:00+00:00|Wellington",
    );
    expect(alert.expires).toBe(Date.parse("2026-07-28T21:00:00+00:00"));
    expect(alert.instruction).toBeNull();
  });

  it("drops entries with neither an event nor a headline", () => {
    const raw = weatherApiFixture({ alerts: { alert: [{ severity: "Minor" }] } });
    expect(normalizeAlerts(raw)).toEqual([]);
  });
});

describe("normalizeDaily", () => {
  it("zips the column arrays into one row per day", () => {
    const daily = normalizeDaily(openMeteoFixture());

    expect(daily).toHaveLength(10);
    expect(daily[0]).toMatchObject({
      date: MIDNIGHT_MS,
      high: 25.8,
      low: 17.2,
      precipitationChance: 28,
    });
  });

  it("labels WMO codes, which Open-Meteo does not send text for", () => {
    const daily = normalizeDaily(openMeteoFixture());

    expect(daily[0].condition).toEqual({
      system: "wmo",
      code: 3,
      text: "Overcast",
      isDay: true,
    });
  });

  it("derives a compass direction, since Open-Meteo sends degrees only", () => {
    expect(normalizeDaily(openMeteoFixture())[0].wind.compass).toBe("NNW");
  });

  it("survives null entries in a column", () => {
    const raw = openMeteoFixture({
      weather_code: Array.from({ length: 10 }, () => null),
      temperature_2m_max: Array.from({ length: 10 }, () => null),
    });

    const daily = normalizeDaily(raw);

    expect(daily[0].condition.text).toBe("Unknown");
    expect(daily[0].high).toBe(0);
  });
});

describe("normalizeLocation", () => {
  it("keeps the IANA zone, which the app formats local times with", () => {
    expect(normalizeLocation(weatherApiFixture())).toEqual({
      name: "Guelph",
      region: "Ontario",
      country: "Canada",
      latitude: 43.54,
      longitude: -80.25,
      timeZone: "America/Toronto",
    });
  });
});
