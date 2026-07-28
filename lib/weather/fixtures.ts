import type { RawDailyResponse } from "./open-meteo/raw";
import type { RawForecastResponse, RawHour } from "./weatherapi/raw";

/**
 * Trimmed vendor payloads for tests. Shapes and field names were checked
 * against the live APIs; values are made up.
 */

/** 2026-07-28T04:00:00Z, which is local midnight in America/Toronto. */
export const LOCAL_MIDNIGHT_SECONDS = 1_785_211_200;
const HOUR = 3_600;

function hour(offsetHours: number, overrides: Partial<RawHour> = {}): RawHour {
  return {
    time_epoch: LOCAL_MIDNIGHT_SECONDS + offsetHours * HOUR,
    temp_c: 17,
    is_day: offsetHours >= 6 && offsetHours < 20 ? 1 : 0,
    condition: { text: "Sunny", icon: "//cdn/day/113.png", code: 1000 },
    wind_kph: 25,
    wind_degree: 315,
    wind_dir: "NW",
    precip_mm: 0,
    humidity: 60,
    feelslike_c: 19,
    chance_of_rain: 20,
    chance_of_snow: 0,
    uv: 5,
    gust_kph: 38,
    ...overrides,
  };
}

export function weatherApiFixture(
  overrides: Partial<RawForecastResponse> = {},
): RawForecastResponse {
  return {
    location: {
      name: "Guelph",
      region: "Ontario",
      country: "Canada",
      lat: 43.54,
      lon: -80.25,
      tz_id: "America/Toronto",
      localtime_epoch: LOCAL_MIDNIGHT_SECONDS + 14 * HOUR,
    },
    current: {
      last_updated_epoch: LOCAL_MIDNIGHT_SECONDS + 14 * HOUR,
      temp_c: 17,
      is_day: 1,
      condition: { text: "Sunny", icon: "//cdn/day/113.png", code: 1000 },
      wind_kph: 25,
      wind_degree: 315,
      wind_dir: "NW",
      pressure_mb: 1013,
      precip_mm: 0,
      humidity: 55,
      cloud: 10,
      feelslike_c: 19,
      dewpoint_c: 8,
      vis_km: 10,
      uv: 6,
      gust_kph: 38,
      air_quality: {
        co: 220.3,
        no2: 5.1,
        o3: 78.6,
        so2: 1.2,
        pm2_5: 6.4,
        pm10: 8.9,
        "us-epa-index": 1,
      },
    },
    forecast: {
      forecastday: [
        {
          date_epoch: LOCAL_MIDNIGHT_SECONDS,
          astro: {
            sunrise: "06:06 AM",
            sunset: "08:48 PM",
            moonrise: "10:12 PM",
            moonset: "07:41 AM",
            moon_phase: "Waning Gibbous",
            moon_illumination: "82",
          },
          hour: Array.from({ length: 24 }, (_, index) => hour(index)),
        },
        {
          date_epoch: LOCAL_MIDNIGHT_SECONDS + 24 * HOUR,
          astro: {
            sunrise: "06:07 AM",
            sunset: "08:47 PM",
            moonrise: "10:44 PM",
            moonset: "08:52 AM",
            moon_phase: "Waning Gibbous",
            moon_illumination: "74",
          },
          hour: Array.from({ length: 24 }, (_, index) => hour(24 + index)),
        },
        {
          date_epoch: LOCAL_MIDNIGHT_SECONDS + 48 * HOUR,
          astro: {
            sunrise: "06:08 AM",
            sunset: "08:46 PM",
            moonrise: "11:20 PM",
            moonset: "10:03 AM",
            moon_phase: "Waning Gibbous",
            moon_illumination: "65",
          },
          hour: Array.from({ length: 24 }, (_, index) => hour(48 + index)),
        },
      ],
    },
    ...overrides,
  };
}

export function openMeteoFixture(
  overrides: Partial<RawDailyResponse["daily"]> = {},
): RawDailyResponse {
  const days = 10;
  const time = Array.from(
    { length: days },
    (_, index) => LOCAL_MIDNIGHT_SECONDS + index * 24 * HOUR,
  );

  return {
    latitude: 43.54,
    longitude: -80.25,
    timezone: "America/Toronto",
    utc_offset_seconds: -14_400,
    daily: {
      time,
      weather_code: time.map(() => 3),
      temperature_2m_max: time.map(() => 25.8),
      temperature_2m_min: time.map(() => 17.2),
      precipitation_probability_max: time.map(() => 28),
      precipitation_sum: time.map(() => 1.4),
      wind_speed_10m_max: time.map(() => 21.6),
      wind_gusts_10m_max: time.map(() => 41.4),
      wind_direction_10m_dominant: time.map(() => 333),
      uv_index_max: time.map(() => 7.1),
      // 06:06:30 and 20:48:23 local on the first day.
      sunrise: time.map((day) => day + 6 * HOUR + 390),
      sunset: time.map((day) => day + 20 * HOUR + 2_903),
      ...overrides,
    },
  };
}
