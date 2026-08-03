import type { WorldSnapshot } from "@/lib/world/world";

/**
 * The leaderboard.
 *
 * Sixteen cities plus yours, ordered by one measure at a time. A grid of cards
 * says what the weather is in each place; a ranking says how yours compares,
 * which is the question the grid quietly raises and never answers
 * (Decisions Log 113).
 *
 * Your city is ranked from the same source as the rest. Comparing an
 * OpenWeatherMap reading for home against Open-Meteo readings for everywhere
 * else would put a vendor difference into the standings and call it weather.
 */

export type RankMetric = "temperature" | "wind" | "rain" | "humidity";

export const RANK_METRICS: { id: RankMetric; label: string; unit: string }[] = [
  { id: "temperature", label: "Warmest", unit: "°" },
  { id: "wind", label: "Windiest", unit: " km/h" },
  { id: "rain", label: "Wettest", unit: " mm" },
  { id: "humidity", label: "Most humid", unit: "%" },
];

/** How many make the board before yours is shown on its own. */
export const TOP_N = 12;

export type RankedCity = {
  snapshot: WorldSnapshot;
  /** One-based, across every city including yours. */
  rank: number;
  value: number;
};

export type Leaderboard = {
  metric: RankMetric;
  top: RankedCity[];
  /**
   * Your city, but only when it did not make the top. Null when it is already
   * in the list above, because showing it twice is noise rather than emphasis.
   */
  yours: RankedCity | null;
  total: number;
};

function valueOf(city: WorldSnapshot, metric: RankMetric): number {
  switch (metric) {
    case "temperature":
      return city.temperature;
    case "wind":
      return city.windKph;
    case "rain":
      return city.precipitation;
    case "humidity":
      return city.humidity;
  }
}

/**
 * Every metric ranks high to low.
 *
 * "Coldest" is deliberately absent: it is the same list read upward, and a
 * control offering both directions of four measures is eight buttons for four
 * ideas.
 */
export function buildLeaderboard(
  cities: WorldSnapshot[],
  metric: RankMetric,
  /** The id of the user's own city, if it is among them. */
  homeId: string | null,
): Leaderboard {
  const ranked = [...cities]
    .sort((a, b) => valueOf(b, metric) - valueOf(a, metric))
    .map((snapshot, index) => ({
      snapshot,
      rank: index + 1,
      value: valueOf(snapshot, metric),
    }));

  const top = ranked.slice(0, TOP_N);
  const home = homeId ? ranked.find((entry) => entry.snapshot.id === homeId) : undefined;

  return {
    metric,
    top,
    yours: home && home.rank > TOP_N ? home : null,
    total: ranked.length,
  };
}

/** Formats a ranked value for display, at the precision the metric deserves. */
export function formatRankValue(value: number, metric: RankMetric): string {
  // Rain is the only one where a fraction of a unit is meaningful; a tenth of a
  // degree or of a percent is noise on a leaderboard.
  return metric === "rain"
    ? `${Math.round(value * 10) / 10}`
    : `${Math.round(value)}`;
}
