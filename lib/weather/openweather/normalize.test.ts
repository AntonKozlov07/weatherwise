import { describe, expect, it } from "vitest";

import {
  degreesToCompass,
  metresPerSecondToKph,
  moonPhaseLabel,
  normalizeAirQuality,
  normalizeAlerts,
  normalizeAstronomy,
  normalizeCurrent,
  normalizeDaily,
  normalizeHourly,
} from "../normalize";
import { conditionInfo, conditionLabel } from "./conditions";
import { isOneCallResponse, type RawOneCallResponse } from "./raw";

const HOUR = 3_600;
/** 2026-07-28T18:00:00Z. */
const NOW_SECONDS = 1_785_261_600;
const NOW_MS = NOW_SECONDS * 1000;

function fixture(overrides: Partial<RawOneCallResponse> = {}): RawOneCallResponse {
  return {
    lat: 45.03,
    lon: -79.31,
    timezone: "America/Toronto",
    timezone_offset: -14_400,
    current: {
      dt: NOW_SECONDS,
      sunrise: NOW_SECONDS - 8 * HOUR,
      sunset: NOW_SECONDS + 4 * HOUR,
      temp: 18.4,
      feels_like: 17.9,
      pressure: 1013,
      humidity: 82,
      dew_point: 12.1,
      uvi: 4.2,
      clouds: 40,
      visibility: 10_000,
      wind_speed: 5,
      wind_deg: 315,
      wind_gust: 11,
      weather: [
        { id: 501, main: "Rain", description: "moderate rain", icon: "10d" },
      ],
      rain: { "1h": 1.2 },
    },
    hourly: Array.from({ length: 48 }, (_, index) => ({
      dt: NOW_SECONDS + index * HOUR,
      temp: 18 - index * 0.1,
      feels_like: 17,
      pressure: 1013,
      humidity: 80,
      dew_point: 12,
      uvi: 3,
      clouds: 40,
      visibility: 10_000,
      wind_speed: 4,
      wind_deg: 300,
      wind_gust: 9,
      weather: [{ id: 800, main: "Clear", description: "clear sky", icon: "01n" }],
      pop: 0.24,
    })),
    daily: Array.from({ length: 8 }, (_, index) => ({
      dt: NOW_SECONDS + index * 24 * HOUR,
      sunrise: NOW_SECONDS - 8 * HOUR + index * 24 * HOUR,
      sunset: NOW_SECONDS + 4 * HOUR + index * 24 * HOUR,
      moonrise: NOW_SECONDS + 2 * HOUR,
      moonset: NOW_SECONDS + 14 * HOUR,
      moon_phase: 0.5,
      temp: { day: 21, min: 12, max: 23, night: 14, eve: 19, morn: 13 },
      feels_like: { day: 21, night: 14, eve: 19, morn: 13 },
      pressure: 1013,
      humidity: 70,
      dew_point: 12,
      wind_speed: 6,
      wind_deg: 290,
      wind_gust: 12,
      weather: [{ id: 804, main: "Clouds", description: "overcast clouds", icon: "04d" }],
      clouds: 90,
      pop: 0.51,
      rain: 2.4,
      uvi: 7.1,
    })),
    ...overrides,
  };
}

describe("isOneCallResponse", () => {
  // The version was not verifiable without a key, so the shape check is what
  // turns a wrong endpoint into a clear error instead of a blank screen.
  it("accepts a well-formed payload and rejects near misses", () => {
    expect(isOneCallResponse(fixture())).toBe(true);
    expect(isOneCallResponse(null)).toBe(false);
    expect(isOneCallResponse({ timezone: "America/Toronto" })).toBe(false);
    expect(isOneCallResponse({ ...fixture(), current: { temp: 1 } })).toBe(false);
  });
});

describe("unit conversion", () => {
  // OWM reports m/s under units=metric and offers no km/h option.
  it("converts wind from metres per second to km/h", () => {
    expect(metresPerSecondToKph(10)).toBeCloseTo(36, 6);
    expect(normalizeCurrent(fixture().current).wind.speed).toBeCloseTo(18, 6);
    expect(normalizeCurrent(fixture().current).wind.gust).toBeCloseTo(39.6, 6);
  });

  it("derives a compass point, since OWM sends degrees only", () => {
    expect(degreesToCompass(315)).toBe("NW");
    expect(normalizeCurrent(fixture().current).wind.compass).toBe("NW");
  });

  it("converts visibility from metres to km and tolerates it being absent", () => {
    expect(normalizeCurrent(fixture().current).visibility).toBe(10);

    const raw = fixture();
    delete raw.current.visibility;
    expect(normalizeCurrent(raw.current).visibility).toBe(0);
  });
});

describe("normalizeCurrent", () => {
  it("labels the condition from the code, not the vendor description", () => {
    // The vendor sends "moderate rain"; the app shows its own wording.
    expect(normalizeCurrent(fixture().current).condition).toEqual({
      code: 501,
      label: "Rain",
      isDay: true,
    });
  });

  // OWM has no is_day field; the icon suffix carries it.
  it("reads day or night from the icon suffix", () => {
    const raw = fixture();
    raw.current.weather[0].icon = "10n";
    expect(normalizeCurrent(raw.current).condition.isDay).toBe(false);
  });

  it("sums rain and snow, which are reported separately", () => {
    const raw = fixture();
    raw.current.snow = { "1h": 0.8 };
    expect(normalizeCurrent(raw.current).precipitation).toBeCloseTo(2, 6);
  });

  it("treats absent precipitation as zero rather than undefined", () => {
    const raw = fixture();
    delete raw.current.rain;
    expect(normalizeCurrent(raw.current).precipitation).toBe(0);
  });
});

describe("normalizeHourly", () => {
  it("converts probability of precipitation to a percentage", () => {
    expect(normalizeHourly(fixture(), NOW_MS)[0].precipitationChance).toBe(24);
  });

  it("caps at 48 points", () => {
    expect(normalizeHourly(fixture(), NOW_MS)).toHaveLength(48);
  });

  // A cached payload served offline can be hours stale.
  it("drops hours that are already in the past", () => {
    const hourly = normalizeHourly(fixture(), NOW_MS + 5 * 3_600_000);
    expect(hourly[0].time).toBeGreaterThanOrEqual(NOW_MS + 5 * 3_600_000 - 3_600_000);
  });

  it("is empty rather than throwing when the block was excluded", () => {
    expect(normalizeHourly(fixture({ hourly: undefined }), NOW_MS)).toEqual([]);
  });
});

describe("normalizeDaily", () => {
  it("reads high and low out of the nested temp object", () => {
    const [today] = normalizeDaily(fixture());

    expect(today.high).toBe(23);
    expect(today.low).toBe(12);
    expect(today.precipitationChance).toBe(51);
    expect(today.humidity).toBe(70);
  });

  it("treats daily rain and snow as totals, not hourly buckets", () => {
    const raw = fixture();
    raw.daily![0].snow = 1.6;
    expect(normalizeDaily(raw)[0].precipitation).toBeCloseTo(4, 6);
  });

  it("is empty rather than throwing when the block was excluded", () => {
    expect(normalizeDaily(fixture({ daily: undefined }))).toEqual([]);
  });
});

describe("normalizeAstronomy", () => {
  it("takes sun and moon times as real instants", () => {
    const astronomy = normalizeAstronomy(fixture());

    expect(astronomy.sunrise).toBe((NOW_SECONDS - 8 * HOUR) * 1000);
    expect(astronomy.sunset).toBe((NOW_SECONDS + 4 * HOUR) * 1000);
    expect(astronomy.moonrise).toBe((NOW_SECONDS + 2 * HOUR) * 1000);
  });

  // WeatherAPI sent an illumination percentage; OWM sends a cycle position.
  it("derives a phase label from the 0 to 1 cycle position", () => {
    expect(normalizeAstronomy(fixture()).moonPhaseLabel).toBe("Full Moon");
    expect(moonPhaseLabel(0)).toBe("New Moon");
    expect(moonPhaseLabel(1)).toBe("New Moon");
    expect(moonPhaseLabel(0.25)).toBe("First Quarter");
    expect(moonPhaseLabel(0.75)).toBe("Last Quarter");
    expect(moonPhaseLabel(0.12)).toBe("Waxing Crescent");
    expect(moonPhaseLabel(0.62)).toBe("Waning Gibbous");
  });

  it("falls back to the daily block when current omits the sun times", () => {
    const raw = fixture();
    delete raw.current.sunrise;
    delete raw.current.sunset;

    expect(normalizeAstronomy(raw).sunrise).toBe((NOW_SECONDS - 8 * HOUR) * 1000);
  });

  it("nulls everything when neither block carries it", () => {
    const raw = fixture({ daily: undefined });
    delete raw.current.sunrise;
    delete raw.current.sunset;

    const astronomy = normalizeAstronomy(raw);
    expect(astronomy.sunrise).toBeNull();
    expect(astronomy.moonPhaseLabel).toBeNull();
  });
});

describe("normalizeAirQuality", () => {
  // OWM's index is 1 to 5, not the 1 to 6 US EPA scale the old vendor used.
  it("maps the index and components", () => {
    const air = normalizeAirQuality({
      aqi: 2,
      components: { pm2_5: 6.4, pm10: 8.9, o3: 78.6, no2: 5.1, so2: 1.2, co: 220.3 },
    });

    expect(air).toEqual({
      index: 2,
      pm2_5: 6.4,
      pm10: 8.9,
      ozone: 78.6,
      nitrogenDioxide: 5.1,
      sulphurDioxide: 1.2,
      carbonMonoxide: 220.3,
    });
  });

  it("is null when the separate air quality call failed", () => {
    expect(normalizeAirQuality(null)).toBeNull();
  });

  it("defaults missing components to zero rather than undefined", () => {
    expect(normalizeAirQuality({ aqi: 1, components: {} })?.pm2_5).toBe(0);
  });
});

describe("normalizeAlerts", () => {
  it("is empty when the payload carries none", () => {
    expect(normalizeAlerts(fixture())).toEqual([]);
  });

  it("builds an id from identifying fields so a dismissal survives a refetch", () => {
    const raw = fixture({
      alerts: [
        {
          sender_name: "Environment Canada",
          event: "Severe Thunderstorm Watch",
          start: NOW_SECONDS,
          end: NOW_SECONDS + 3 * HOUR,
          description: "Conditions are favourable. Take shelter if threatening.",
          tags: ["Thunderstorm"],
        },
      ],
    });

    const [alert] = normalizeAlerts(raw);

    expect(alert.id).toBe(
      `Severe Thunderstorm Watch|${NOW_SECONDS}|Environment Canada`,
    );
    expect(alert.source).toBe("Environment Canada");
    expect(alert.expires).toBe((NOW_SECONDS + 3 * HOUR) * 1000);
    expect(alert.tags).toEqual(["Thunderstorm"]);
  });

  it("drops entries with no event", () => {
    expect(normalizeAlerts(fixture({ alerts: [{ description: "x" }] }))).toEqual([]);
  });
});

describe("condition mapping", () => {
  it("labels codes rather than passing the vendor description through", () => {
    expect(conditionLabel(800)).toBe("Clear");
    expect(conditionLabel(801)).toBe("Mostly Sunny");
    expect(conditionLabel(804)).toBe("Overcast");
    expect(conditionLabel(741)).toBe("Fog");
  });

  // A code OWM adds later should still land in the right family.
  it("falls back by hundreds group before falling back to clear", () => {
    expect(conditionInfo(599).bucket).toBe("rain");
    expect(conditionInfo(699).bucket).toBe("snow");
    expect(conditionInfo(299).bucket).toBe("thunderstorm");
    expect(conditionInfo(1234).bucket).toBe("clear");
  });

  it("classifies freezing rain as snow, since that is what the sky looks like", () => {
    expect(conditionInfo(511).bucket).toBe("snow");
  });
});
