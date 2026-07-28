import { beforeEach, describe, expect, it, vi } from "vitest";

import { WeatherError } from "./errors";
import { LOCAL_MIDNIGHT_SECONDS, openMeteoFixture, weatherApiFixture } from "./fixtures";

vi.mock("./weatherapi/client", () => ({ fetchForecast: vi.fn() }));
vi.mock("./open-meteo/client", () => ({ fetchDailyForecast: vi.fn() }));

const { fetchForecast } = await import("./weatherapi/client");
const { fetchDailyForecast } = await import("./open-meteo/client");
const { getForecastBundle } = await import("./forecast");

const COORDINATES = { latitude: 43.54, longitude: -80.25 };
const NOW = (LOCAL_MIDNIGHT_SECONDS + 14 * 3_600) * 1000;

beforeEach(() => {
  vi.mocked(fetchForecast).mockReset();
  vi.mocked(fetchDailyForecast).mockReset();
});

describe("getForecastBundle", () => {
  it("merges both sources when both succeed", async () => {
    vi.mocked(fetchForecast).mockResolvedValue(weatherApiFixture());
    vi.mocked(fetchDailyForecast).mockResolvedValue(openMeteoFixture());

    const bundle = await getForecastBundle(COORDINATES, NOW);

    expect(bundle.current.temperature).toBe(17);
    expect(bundle.daily).toHaveLength(10);
    expect(bundle.sources).toEqual({
      weatherapi: { ok: true },
      openMeteo: { ok: true },
    });
    expect(bundle.fetchedAt).toBe(NOW);
  });

  it("requests both sources concurrently rather than in sequence", async () => {
    const order: string[] = [];

    vi.mocked(fetchForecast).mockImplementation(async () => {
      order.push("weatherapi:start");
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push("weatherapi:end");
      return weatherApiFixture();
    });
    vi.mocked(fetchDailyForecast).mockImplementation(async () => {
      order.push("openmeteo:start");
      return openMeteoFixture();
    });

    await getForecastBundle(COORDINATES, NOW);

    // Open-Meteo starts before WeatherAPI finishes, so they overlap.
    expect(order.indexOf("openmeteo:start")).toBeLessThan(
      order.indexOf("weatherapi:end"),
    );
  });

  // The whole point of splitting the sources is that one can fail alone.
  it("degrades to an empty week when only Open-Meteo fails", async () => {
    vi.mocked(fetchForecast).mockResolvedValue(weatherApiFixture());
    vi.mocked(fetchDailyForecast).mockRejectedValue(
      new WeatherError("timeout", "Open-Meteo did not respond in time.", {
        source: "Open-Meteo",
      }),
    );

    const bundle = await getForecastBundle(COORDINATES, NOW);

    expect(bundle.daily).toEqual([]);
    expect(bundle.sources.openMeteo).toEqual({
      ok: false,
      reason: "Open-Meteo did not respond in time.",
    });
    // Current conditions are the reason not to fail the whole request.
    expect(bundle.current.temperature).toBe(17);
    expect(bundle.hourly.length).toBeGreaterThan(0);
    // Sun times came from the source that failed.
    expect(bundle.astronomy.sunrise).toBeNull();
    expect(bundle.astronomy.moonPhase).toBe("Waning Gibbous");
  });

  it("propagates when WeatherAPI fails, since there is nothing to render", async () => {
    vi.mocked(fetchForecast).mockRejectedValue(
      new WeatherError("config", "Weather service rejected the API key.", {
        source: "WeatherAPI",
      }),
    );
    vi.mocked(fetchDailyForecast).mockResolvedValue(openMeteoFixture());

    await expect(getForecastBundle(COORDINATES, NOW)).rejects.toThrow(
      /rejected the API key/,
    );
  });
});
