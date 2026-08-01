import { describe, expect, it } from "vitest";

import { CLIMATE_GRADIENT, WORLD_CITIES, cityCoordinates } from "./cities";
import { wmoToOwm, KNOWN_WMO_CODES } from "@/lib/weather/openmeteo/wmo";
import { conditionInfo } from "@/lib/weather/openweather/conditions";
import { AA_TEXT, contrastRatio } from "@/lib/theme/contrast";

const TEXT = "#edeae4";
const ON_BAND_DIM = "#dcd9d3";

describe("world cities", () => {
  it("has eight, each with a distinct id", () => {
    expect(WORLD_CITIES).toHaveLength(8);
    expect(new Set(WORLD_CITIES.map((city) => city.id)).size).toBe(8);
  });

  it("spans both hemispheres and several climates", () => {
    expect(WORLD_CITIES.some((city) => city.latitude < 0)).toBe(true);
    expect(new Set(WORLD_CITIES.map((city) => city.climate)).size).toBeGreaterThanOrEqual(4);
  });

  it("builds one query covering every city, in order", () => {
    const { latitudes, longitudes } = cityCoordinates();

    expect(latitudes.split(",")).toHaveLength(8);
    expect(longitudes.split(",")).toHaveLength(8);
    expect(latitudes.split(",")[0]).toBe(String(WORLD_CITIES[0].latitude));
  });

  /**
   * The same check the hero gradients get, for the same reason: a palette
   * chosen for looks and never measured is how text became unreadable on the
   * main card. These cards carry a city name and a temperature.
   */
  it.each(Object.entries(CLIMATE_GRADIENT))(
    "carries text on every stop of the %s gradient",
    (_climate, stops) => {
      for (const stop of stops) {
        expect(stop).toMatch(/^#[0-9a-f]{6}$/i);
        expect(contrastRatio(TEXT, stop)).toBeGreaterThanOrEqual(AA_TEXT);
        expect(contrastRatio(ON_BAND_DIM, stop)).toBeGreaterThanOrEqual(AA_TEXT);
      }
    },
  );

  it("gives every climate a gradient", () => {
    for (const city of WORLD_CITIES) {
      expect(CLIMATE_GRADIENT[city.climate]).toBeDefined();
    }
  });
});

describe("wmoToOwm", () => {
  it("maps the clear and cloud range", () => {
    expect(conditionInfo(wmoToOwm(0)).bucket).toBe("clear");
    expect(conditionInfo(wmoToOwm(3)).bucket).toBe("overcast");
  });

  it("maps precipitation to the right buckets", () => {
    expect(conditionInfo(wmoToOwm(65)).bucket).toBe("rain");
    expect(conditionInfo(wmoToOwm(75)).bucket).toBe("snow");
    expect(conditionInfo(wmoToOwm(82)).bucket).toBe("rain");
    expect(conditionInfo(wmoToOwm(86)).bucket).toBe("snow");
  });

  it("maps fog and thunderstorms", () => {
    expect(conditionInfo(wmoToOwm(45)).bucket).toBe("fog");
    expect(conditionInfo(wmoToOwm(95)).bucket).toBe("thunderstorm");
    expect(conditionInfo(wmoToOwm(99)).bucket).toBe("thunderstorm");
  });

  /**
   * Every code has to resolve to something this app has a label and an icon
   * for, or a world card renders blank for weather that is perfectly ordinary
   * somewhere else.
   */
  it("resolves every known code to a labelled condition", () => {
    for (const code of KNOWN_WMO_CODES) {
      const info = conditionInfo(wmoToOwm(code));

      expect(info.label.length).toBeGreaterThan(0);
      expect(info.bucket).toBeTruthy();
    }
  });

  it("falls back to clear for a code it does not know", () => {
    expect(wmoToOwm(9999)).toBe(800);
    expect(conditionInfo(wmoToOwm(9999)).bucket).toBe("clear");
  });
});
