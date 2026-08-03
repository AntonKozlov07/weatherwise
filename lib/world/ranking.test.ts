import { describe, expect, it } from "vitest";

import { buildLeaderboard, formatRankValue, TOP_N } from "./ranking";
import { HOME_CITY_ID, type WorldSnapshot } from "./world";

function city(
  id: string,
  values: Partial<Pick<WorldSnapshot, "temperature" | "windKph" | "precipitation" | "humidity">>,
): WorldSnapshot {
  return {
    id,
    name: id,
    country: "XX",
    latitude: 0,
    longitude: 0,
    climate: "temperate",
    condition: { code: 800, label: "Clear", isDay: true },
    temperature: 20,
    feelsLike: 20,
    humidity: 50,
    windKph: 10,
    precipitation: 0,
    observedAt: 0,
    timeZone: "UTC",
    ...values,
  };
}

/** Sixteen ranked cities, warmest first when read by temperature. */
const many = Array.from({ length: 16 }, (_, index) =>
  city(`c${index}`, { temperature: 40 - index, windKph: index, precipitation: index / 2 }),
);

describe("buildLeaderboard", () => {
  it("orders high to low and numbers from one", () => {
    const board = buildLeaderboard(many, "temperature", null);

    expect(board.top[0].snapshot.id).toBe("c0");
    expect(board.top[0].rank).toBe(1);
    expect(board.top[0].value).toBe(40);
    expect(board.top).toHaveLength(TOP_N);
  });

  it("ranks by whichever measure was asked for", () => {
    const byWind = buildLeaderboard(many, "wind", null);

    // Wind climbs with the index, so the order inverts against temperature.
    expect(byWind.top[0].snapshot.id).toBe("c15");
  });

  describe("the user's own city", () => {
    it("is shown separately when it misses the cut", () => {
      const cities = [...many, city(HOME_CITY_ID, { temperature: -5 })];
      const board = buildLeaderboard(cities, "temperature", HOME_CITY_ID);

      expect(board.yours?.snapshot.id).toBe(HOME_CITY_ID);
      expect(board.yours?.rank).toBe(17);
      expect(board.total).toBe(17);
    });

    /**
     * Showing it twice is noise rather than emphasis: it is already on the
     * board, highlighted, where the reader can see it.
     */
    it("is not repeated when it already made the top", () => {
      const cities = [...many, city(HOME_CITY_ID, { temperature: 99 })];
      const board = buildLeaderboard(cities, "temperature", HOME_CITY_ID);

      expect(board.top[0].snapshot.id).toBe(HOME_CITY_ID);
      expect(board.yours).toBeNull();
    });

    it("is absent entirely when no home city was supplied", () => {
      expect(buildLeaderboard(many, "temperature", null).yours).toBeNull();
    });
  });

  it("copes with fewer cities than the cut", () => {
    const board = buildLeaderboard(many.slice(0, 3), "temperature", null);

    expect(board.top).toHaveLength(3);
    expect(board.total).toBe(3);
  });

  it("returns an empty board rather than throwing with no cities", () => {
    const board = buildLeaderboard([], "temperature", HOME_CITY_ID);

    expect(board.top).toEqual([]);
    expect(board.yours).toBeNull();
  });
});

describe("formatRankValue", () => {
  // A tenth of a degree is noise on a leaderboard; a tenth of a millimetre of
  // rain is the difference between damp and dry.
  it("keeps a decimal for rain and rounds everything else", () => {
    expect(formatRankValue(12.4, "temperature")).toBe("12");
    expect(formatRankValue(12.44, "rain")).toBe("12.4");
    expect(formatRankValue(12.6, "wind")).toBe("13");
  });
});
