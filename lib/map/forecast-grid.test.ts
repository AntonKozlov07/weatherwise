import { describe, expect, it } from "vitest";

import {
  GRID_SIDE,
  gridAtHour,
  gridCoordinates,
  parseForecastGrid,
  wetHours,
} from "./forecast-grid";

describe("gridCoordinates", () => {
  it("produces a square grid centred on the point", () => {
    const { latitudes, longitudes } = gridCoordinates(43.33, -79.8);

    expect(latitudes).toHaveLength(GRID_SIDE * GRID_SIDE);
    expect(longitudes).toHaveLength(GRID_SIDE * GRID_SIDE);
    // The middle sample is the centre itself.
    const middle = Math.floor((GRID_SIDE * GRID_SIDE) / 2);
    expect(latitudes[middle]).toBeCloseTo(43.33, 2);
    expect(longitudes[middle]).toBeCloseTo(-79.8, 1);
  });

  /**
   * Longitude spacing is divided by the cosine of the latitude, or the grid
   * stretches east to west as it moves away from the equator. At Reykjavík it
   * would otherwise be twice as wide as it is tall.
   */
  it("keeps cells roughly square at high latitude", () => {
    const spread = (lat: number) => {
      const { longitudes } = gridCoordinates(lat, 0);
      return Math.max(...longitudes) - Math.min(...longitudes);
    };

    expect(spread(64)).toBeGreaterThan(spread(0) * 1.8);
  });

  it("does not divide by zero at the pole", () => {
    const { longitudes } = gridCoordinates(90, 0);
    expect(longitudes.every((value) => Number.isFinite(value))).toBe(true);
  });
});

/** Two points, three hours, with a local clock nine hours ahead. */
const payload = [
  {
    latitude: 1,
    longitude: 2,
    utc_offset_seconds: 9 * 3600,
    hourly: {
      time: ["2026-08-01T09:00", "2026-08-01T10:00", "2026-08-01T11:00"],
      precipitation: [0, 4, 0],
    },
  },
  {
    latitude: 3,
    longitude: 4,
    utc_offset_seconds: 9 * 3600,
    hourly: {
      time: ["2026-08-01T09:00", "2026-08-01T10:00", "2026-08-01T11:00"],
      precipitation: [0, 0, 0.05],
    },
  },
];

/** The fixture's three hours, as instants, for tests that trim. */
const HOUR_0 = Date.parse("2026-08-01T00:00Z");
const HOUR_MS = 3_600_000;

describe("parseForecastGrid", () => {
  it("reads every point and finds the peak", () => {
    const grid = parseForecastGrid(payload, HOUR_0)!;

    expect(grid.points).toHaveLength(2);
    expect(grid.peak).toBe(4);
    expect(grid.times).toHaveLength(3);
  });

  // The same wall-clock trap that made the world board show Tokyo nine hours out.
  it("subtracts the offset rather than treating local time as UTC", () => {
    const grid = parseForecastGrid(payload, HOUR_0)!;

    expect(grid.times[0]).toBe(HOUR_0);
  });

  /**
   * Open-Meteo returns whole days, so the response starts at midnight and the
   * first third of it is already over. A forward layer that opens on this
   * morning is the complaint it exists to answer.
   */
  describe("trimming the past", () => {
    it("starts at the hour you are in", () => {
      const grid = parseForecastGrid(payload, HOUR_0 + 2 * HOUR_MS)!;

      expect(grid.times).toHaveLength(1);
      expect(grid.times[0]).toBe(HOUR_0 + 2 * HOUR_MS);
      expect(grid.points[0].precipitation).toEqual([0]);
    });

    // The hour in progress has not finished raining yet.
    it("keeps the current hour rather than the next one", () => {
      const grid = parseForecastGrid(payload, HOUR_0 + HOUR_MS + 59 * 60_000)!;

      expect(grid.times[0]).toBe(HOUR_0 + HOUR_MS);
    });

    it("recomputes the peak from what is left", () => {
      // The 4mm hour is trimmed away, so the peak drops with it.
      const grid = parseForecastGrid(payload, HOUR_0 + 2 * HOUR_MS)!;

      expect(grid.peak).toBe(0.05);
    });

    it("returns null when the whole window is behind us", () => {
      expect(parseForecastGrid(payload, HOUR_0 + 99 * HOUR_MS)).toBeNull();
    });
  });

  it("returns null for anything that is not a grid", () => {
    expect(parseForecastGrid(null)).toBeNull();
    expect(parseForecastGrid([])).toBeNull();
    expect(parseForecastGrid([{ latitude: 1 }])).toBeNull();
  });
});

describe("gridAtHour", () => {
  /**
   * A heatmap weights every feature it is given, so a full grid of zeroes still
   * tints the map. Dry points are dropped rather than sent at zero, or a clear
   * day would show drizzle everywhere.
   */
  it("omits dry points entirely", () => {
    const grid = parseForecastGrid(payload, HOUR_0)!;

    expect(gridAtHour(grid, 0).features).toHaveLength(0);
    expect(gridAtHour(grid, 1).features).toHaveLength(1);
  });

  it("ignores a trace below the floor", () => {
    const grid = parseForecastGrid(payload, HOUR_0)!;
    // 0.05mm at hour 2 is a rounding artefact, not rain.
    expect(gridAtHour(grid, 2).features).toHaveLength(0);
  });

  it("eases the weight so drizzle is visible beside a downpour", () => {
    const grid = parseForecastGrid(payload, HOUR_0)!;
    expect(gridAtHour(grid, 1).features[0].properties.value).toBe(2);
  });

  it("clamps an hour outside the range rather than returning nothing", () => {
    const grid = parseForecastGrid(payload, HOUR_0)!;

    expect(gridAtHour(grid, 99).features).toEqual(gridAtHour(grid, 2).features);
    expect(gridAtHour(grid, -5).features).toEqual(gridAtHour(grid, 0).features);
  });
});

describe("wetHours", () => {
  it("lists only the hours with rain somewhere on the grid", () => {
    expect(wetHours(parseForecastGrid(payload, HOUR_0)!)).toEqual([1]);
  });
});
