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
import {
  isCurrentResponse,
  isDailyResponse,
  isHourlyResponse,
  type RawCurrentRecord,
  type RawDayRecord,
  type RawEnvelope,
  type RawHourRecord,
} from "./raw";

const HOUR = 3_600;
/** 2026-07-28T18:00:00Z. */
const NOW_SECONDS = 1_785_261_600;
const NOW_MS = NOW_SECONDS * 1000;

function envelope<T>(data: T[]): RawEnvelope<T> {
  return {
    lat: 45.03,
    lon: -79.31,
    timezone: "America/Toronto",
    timezone_offset: -14_400,
    data,
  };
}

function currentRecord(
  overrides: Partial<RawCurrentRecord> = {},
): RawCurrentRecord {
  return {
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
    weather: [{ id: 501, main: "Rain", description: "moderate rain", icon: "10d" }],
    ...overrides,
  };
}

function hourRecord(index: number): RawHourRecord {
  return {
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
    rain: { "1h": 0.6 },
  };
}

function dayRecord(index: number): RawDayRecord {
  return {
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
    uvi: 7.1,
    clouds: 90,
    visibility: 10_000,
    wind_speed: 6,
    wind_deg: 290,
    wind_gust: 12,
    weather: [
      { id: 804, main: "Clouds", description: "overcast clouds", icon: "04d" },
    ],
    pop: 0.51,
    rain: 2.4,
  };
}

const current = () => envelope([currentRecord()]);
const hourly = () => envelope(Array.from({ length: 48 }, (_, i) => hourRecord(i)));
const daily = () => envelope(Array.from({ length: 8 }, (_, i) => dayRecord(i)));

describe("shape guards", () => {
  // 4.0 wraps everything in a data array, unlike 3.0's named blocks. These
  // guards turn a wrong endpoint into a clear error instead of blank cards.
  it("accepts each endpoint's real shape", () => {
    expect(isCurrentResponse(current())).toBe(true);
    expect(isHourlyResponse(hourly())).toBe(true);
    expect(isDailyResponse(daily())).toBe(true);
  });

  it("rejects a 3.0 style payload with named blocks and no data array", () => {
    const threePointZero = {
      timezone: "America/Toronto",
      timezone_offset: -14_400,
      current: { temp: 18 },
    };

    expect(isCurrentResponse(threePointZero)).toBe(false);
  });

  // Daily temp is an object; hourly and current are numbers. Mixing the
  // endpoints up would otherwise read as valid and crash later, so each guard
  // rejects the other's payload in both directions.
  it("tells the daily and hourly shapes apart", () => {
    expect(isDailyResponse(hourly())).toBe(false);
    expect(isHourlyResponse(daily())).toBe(false);
  });

  it("accepts an empty timeline rather than calling it malformed", () => {
    expect(isHourlyResponse(envelope([]))).toBe(true);
    expect(isDailyResponse(envelope([]))).toBe(true);
  });

  it("rejects anything without the envelope", () => {
    expect(isCurrentResponse(null)).toBe(false);
    expect(isCurrentResponse({ data: [] })).toBe(false);
    expect(isCurrentResponse(envelope([]))).toBe(false);
  });
});

describe("unit conversion", () => {
  // OWM reports m/s under units=metric and offers no km/h option.
  it("converts wind from metres per second to km/h", () => {
    expect(metresPerSecondToKph(10)).toBeCloseTo(36, 6);

    const wind = normalizeCurrent(currentRecord()).wind;
    expect(wind.speed).toBeCloseTo(18, 6);
    expect(wind.gust).toBeCloseTo(39.6, 6);
  });

  it("derives a compass point, since OWM sends degrees only", () => {
    expect(degreesToCompass(315)).toBe("NW");
    expect(normalizeCurrent(currentRecord()).wind.compass).toBe("NW");
  });

  it("converts visibility to km and tolerates it being absent", () => {
    expect(normalizeCurrent(currentRecord()).visibility).toBe(10);
    expect(
      normalizeCurrent(currentRecord({ visibility: undefined })).visibility,
    ).toBe(0);
  });
});

describe("normalizeCurrent", () => {
  it("labels the condition from the code, not the vendor description", () => {
    // The vendor sends "moderate rain"; the app shows its own wording.
    expect(normalizeCurrent(currentRecord()).condition).toEqual({
      code: 501,
      label: "Rain",
      isDay: true,
    });
  });

  // OWM has no is_day field; the icon suffix carries it.
  it("reads day or night from the icon suffix", () => {
    const record = currentRecord({
      weather: [{ id: 501, main: "Rain", description: "", icon: "10n" }],
    });

    expect(normalizeCurrent(record).condition.isDay).toBe(false);
  });

  // The 4.0 current endpoint has no rain or snow field, unlike hourly.
  it("reports no precipitation, which current does not carry", () => {
    expect(normalizeCurrent(currentRecord()).precipitation).toBe(0);
  });
});

describe("normalizeHourly", () => {
  it("converts probability of precipitation to a percentage", () => {
    expect(normalizeHourly(hourly(), NOW_MS)[0].precipitationChance).toBe(24);
  });

  it("sums the hourly rain and snow buckets", () => {
    const withSnow = envelope([{ ...hourRecord(0), snow: { "1h": 0.4 } }]);
    expect(normalizeHourly(withSnow, NOW_MS)[0].precipitation).toBeCloseTo(1, 6);
  });

  it("caps at 48 points", () => {
    expect(normalizeHourly(hourly(), NOW_MS)).toHaveLength(48);
  });

  // A cached payload served offline can be hours stale.
  it("drops hours already in the past", () => {
    const points = normalizeHourly(hourly(), NOW_MS + 5 * 3_600_000);
    expect(points[0].time).toBeGreaterThanOrEqual(NOW_MS + 4 * 3_600_000);
  });

  // Hourly is allowed to fail on its own without taking the screen down.
  it("is empty when the request failed", () => {
    expect(normalizeHourly(null, NOW_MS)).toEqual([]);
  });
});

describe("normalizeDaily", () => {
  it("reads high and low out of the nested temp object", () => {
    const [today] = normalizeDaily(daily());

    expect(today.high).toBe(23);
    expect(today.low).toBe(12);
    expect(today.precipitationChance).toBe(51);
    expect(today.humidity).toBe(70);
  });

  // Daily precipitation is a bare total; hourly is a { "1h": mm } bucket.
  it("accepts daily precipitation as a number or a bucket", () => {
    expect(normalizeDaily(daily())[0].precipitation).toBeCloseTo(2.4, 6);

    const bucketed = envelope([{ ...dayRecord(0), rain: { "1h": 1.1 } }]);
    expect(normalizeDaily(bucketed)[0].precipitation).toBeCloseTo(1.1, 6);
  });

  it("is empty when the request failed", () => {
    expect(normalizeDaily(null)).toEqual([]);
  });
});

describe("normalizeAstronomy", () => {
  it("takes sun and moon times as real instants", () => {
    const astronomy = normalizeAstronomy(currentRecord(), daily());

    expect(astronomy.sunrise).toBe((NOW_SECONDS - 8 * HOUR) * 1000);
    expect(astronomy.sunset).toBe((NOW_SECONDS + 4 * HOUR) * 1000);
    expect(astronomy.moonrise).toBe((NOW_SECONDS + 2 * HOUR) * 1000);
  });

  // WeatherAPI sent an illumination percentage; OWM sends a cycle position.
  it("derives a phase label from the 0 to 1 cycle position", () => {
    expect(normalizeAstronomy(currentRecord(), daily()).moonPhaseLabel).toBe(
      "Full Moon",
    );
    expect(moonPhaseLabel(0)).toBe("New Moon");
    expect(moonPhaseLabel(1)).toBe("New Moon");
    expect(moonPhaseLabel(0.25)).toBe("First Quarter");
    expect(moonPhaseLabel(0.75)).toBe("Last Quarter");
    expect(moonPhaseLabel(0.12)).toBe("Waxing Crescent");
    expect(moonPhaseLabel(0.62)).toBe("Waning Gibbous");
  });

  it("falls back to the daily block when current omits the sun times", () => {
    const record = currentRecord({ sunrise: undefined, sunset: undefined });
    expect(normalizeAstronomy(record, daily()).sunrise).toBe(
      (NOW_SECONDS - 8 * HOUR) * 1000,
    );
  });

  // Losing daily costs the moon rows but must not break the gradient anchor.
  it("keeps the sun times when the daily request failed", () => {
    const astronomy = normalizeAstronomy(currentRecord(), null);

    expect(astronomy.sunrise).toBe((NOW_SECONDS - 8 * HOUR) * 1000);
    expect(astronomy.moonrise).toBeNull();
    expect(astronomy.moonPhaseLabel).toBeNull();
  });
});

describe("normalizeAirQuality", () => {
  // OWM's index is 1 to 5, not the 1 to 6 US EPA scale the old vendor used.
  it("maps the index and components", () => {
    expect(
      normalizeAirQuality({
        aqi: 2,
        components: { pm2_5: 6.4, pm10: 8.9, o3: 78.6, no2: 5.1, so2: 1.2, co: 220.3 },
      }),
    ).toEqual({
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
  it("is empty when nothing is in effect", () => {
    expect(normalizeAlerts([])).toEqual([]);
  });

  // 4.0 gives alerts a real id, so the dismissal key needs no synthesising.
  it("keys on the vendor id", () => {
    const [alert] = normalizeAlerts([
      {
        id: "8B46C632-DCA7-44D7-8BDF-02445621BAFF",
        sender_name: "Environment Canada",
        event: "Severe Thunderstorm Watch",
        start: NOW_SECONDS,
        end: NOW_SECONDS + 3 * HOUR,
        description: "Conditions are favourable. Take shelter if threatening.",
      },
    ]);

    expect(alert.id).toBe("8B46C632-DCA7-44D7-8BDF-02445621BAFF");
    expect(alert.source).toBe("Environment Canada");
    expect(alert.expires).toBe((NOW_SECONDS + 3 * HOUR) * 1000);
  });

  it("synthesises a key when the detail payload has no id", () => {
    const [alert] = normalizeAlerts([
      { event: "Frost Advisory", start: NOW_SECONDS },
    ]);

    expect(alert.id).toBe(`Frost Advisory|${NOW_SECONDS}`);
  });

  it("drops entries with no event", () => {
    expect(normalizeAlerts([{ description: "x" }])).toEqual([]);
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
