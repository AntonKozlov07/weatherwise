import { describe, expect, it } from "vitest";

import { buildTimeline, rowIndexAt, spinePath } from "./timeline";
import type { Astronomy, DailyPoint, HourlyPoint } from "@/lib/weather/types";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 6, 28, 12, 0);

const condition = { code: 800, label: "Clear", isDay: true };
const wind = { speed: 10, gust: 12, direction: 270, compass: "W" };

function hours(temps: number[], precip: number[] = []): HourlyPoint[] {
  return temps.map((temperature, index) => ({
    time: NOW + index * HOUR,
    condition,
    temperature,
    feelsLike: temperature,
    precipitationChance: 10,
    precipitation: precip[index] ?? 0,
    humidity: 50,
    uvIndex: 3,
    wind,
  }));
}

function days(count: number, from = NOW + 60 * HOUR): DailyPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    date: from + index * 24 * HOUR,
    condition,
    high: 20 + index,
    low: 10 + index,
    precipitationChance: 20,
    precipitation: 0,
    humidity: 55,
    uvIndex: 5,
    wind,
  }));
}

const astronomy: Astronomy = {
  sunrise: NOW + 2 * HOUR,
  sunset: NOW + 10 * HOUR,
  moonrise: null,
  moonset: null,
  moonPhase: null,
  moonPhaseLabel: null,
};

const noSun: Astronomy = { ...astronomy, sunrise: null, sunset: null };

describe("buildTimeline", () => {
  it("runs hours into days with no gap and no overlap", () => {
    const rows = buildTimeline({
      hourly: hours(new Array(48).fill(15)),
      daily: days(8, NOW),
      astronomy: noSun,
      now: NOW,
    });

    const kinds = rows.map((row) => row.kind);
    const lastHour = kinds.lastIndexOf("hour");
    const firstDay = kinds.indexOf("day");

    expect(firstDay).toBe(lastHour + 1);
    // Days that fall inside the hourly window would state the same thing twice.
    const hourEnd = rows[lastHour].time;
    for (const row of rows.filter((r) => r.kind === "day")) {
      expect(row.time).toBeGreaterThan(hourEnd);
    }
  });

  it("is sorted by time throughout", () => {
    const rows = buildTimeline({
      hourly: hours(new Array(24).fill(15)),
      daily: days(5),
      astronomy,
      now: NOW,
    });

    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].time).toBeGreaterThanOrEqual(rows[i - 1].time);
    }
  });

  it("threads sun events in at their real position", () => {
    const rows = buildTimeline({
      hourly: hours(new Array(24).fill(15)),
      daily: [],
      astronomy,
      now: NOW,
    });

    const sun = rows.filter((row) => row.kind === "sun");
    expect(sun.map((row) => row.kind === "sun" && row.event)).toEqual([
      "sunrise",
      "sunset",
    ]);

    const sunriseIndex = rows.findIndex((row) => row.kind === "sun");
    expect(rows[sunriseIndex - 1].time).toBeLessThanOrEqual(astronomy.sunrise!);
    expect(rows[sunriseIndex + 1].time).toBeGreaterThanOrEqual(astronomy.sunrise!);
  });

  /**
   * The daily payload carries no sun times, so inferring later days from a
   * 24-hour offset would drift and be wrong in the season people notice.
   */
  it("adds no sun rows outside the hourly window", () => {
    const rows = buildTimeline({
      hourly: hours(new Array(4).fill(15)),
      daily: days(6),
      astronomy,
      now: NOW,
    });

    // Sunset is 10 hours out, past the 4 hours of hourly data.
    const events = rows.filter((row) => row.kind === "sun");
    expect(events).toHaveLength(1);
  });

  it("drops hours that have already passed", () => {
    const rows = buildTimeline({
      hourly: hours(new Array(12).fill(15)),
      daily: [],
      astronomy: noSun,
      now: NOW + 6 * HOUR,
    });

    expect(rows.every((row) => row.time >= NOW + 5 * HOUR)).toBe(true);
  });

  it("returns nothing rather than guessing when there is no data", () => {
    expect(
      buildTimeline({ hourly: [], daily: [], astronomy: noSun, now: NOW }),
    ).toEqual([]);
  });

  describe("the spine", () => {
    it("puts the coldest hour at 0 and the warmest at 1", () => {
      const rows = buildTimeline({
        hourly: hours([5, 10, 15, 20, 25]),
        daily: [],
        astronomy: noSun,
        now: NOW,
      });

      const spines = rows.map((row) => row.spine);
      expect(Math.min(...spines)).toBeCloseTo(0);
      expect(Math.max(...spines)).toBeCloseTo(1);
    });

    // A dead-flat line reads as broken rather than calm, so the range is padded.
    it("does not pin a flat day to one edge", () => {
      const rows = buildTimeline({
        hourly: hours([15, 15.2, 15, 14.8]),
        daily: [],
        astronomy: noSun,
        now: NOW,
      });

      for (const row of rows) {
        expect(row.spine).toBeGreaterThan(0.2);
        expect(row.spine).toBeLessThan(0.8);
      }
    });

    it("stays inside the range once days join the hours", () => {
      const rows = buildTimeline({
        hourly: hours(new Array(48).fill(2)),
        daily: days(8),
        astronomy: noSun,
        now: NOW,
      });

      for (const row of rows) {
        expect(row.spine).toBeGreaterThanOrEqual(0);
        expect(row.spine).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("precipitation bars", () => {
    it("ignores traces but shows light rain next to heavy", () => {
      const rows = buildTimeline({
        hourly: hours([15, 15, 15, 15], [0, 0.05, 0.5, 8]),
        daily: [],
        astronomy: noSun,
        now: NOW,
      });

      const wet = rows.map((row) => (row.kind === "hour" ? row.wet : -1));

      expect(wet[0]).toBe(0);
      expect(wet[1]).toBe(0);
      // Linear scaling would make this 0.06 and invisible.
      expect(wet[2]).toBeGreaterThan(0.2);
      expect(wet[3]).toBe(1);
    });
  });
});

describe("spinePath", () => {
  const rows = buildTimeline({
    hourly: hours([5, 12, 8, 20]),
    daily: [],
    astronomy: noSun,
    now: NOW,
  });

  it("draws a curve through every row", () => {
    const path = spinePath(rows, 100, 56);

    expect(path.startsWith("M ")).toBe(true);
    expect(path.match(/C /g)).toHaveLength(rows.length - 1);
    expect(path).not.toContain("NaN");
  });

  it("returns nothing for an empty timeline rather than a broken path", () => {
    expect(spinePath([], 100, 56)).toBe("");
  });

  it("centres each point in its row", () => {
    const path = spinePath(rows, 100, 56);

    expect(path).toContain("28.00");
  });
});

describe("rowIndexAt", () => {
  const rows = buildTimeline({
    hourly: hours(new Array(12).fill(15)),
    daily: [],
    astronomy: noSun,
    now: NOW,
  });

  it("snaps to the nearest row, not the next one", () => {
    expect(rowIndexAt(rows, NOW + 3 * HOUR + 60_000)).toBe(3);
    expect(rowIndexAt(rows, NOW + 3 * HOUR + 50 * 60_000)).toBe(4);
  });

  it("clamps to the ends", () => {
    expect(rowIndexAt(rows, NOW - 100 * HOUR)).toBe(0);
    expect(rowIndexAt(rows, NOW + 100 * HOUR)).toBe(rows.length - 1);
  });

  it("reports -1 when there is nothing to snap to", () => {
    expect(rowIndexAt([], NOW)).toBe(-1);
  });
});
