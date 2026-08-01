/**
 * The world board.
 *
 * Eight cities, fixed, chosen for contrast rather than importance: at any hour
 * some of them are in a season the others are not, and that difference is the
 * whole point of the screen. Not the user's saved locations, which are on the
 * home screen already (Decisions Log 102).
 *
 * The climate tag is hand-written per city rather than derived. Eight values
 * that never change are honest as data; classifying them at runtime would be
 * logic that can be wrong about a fact we already know.
 */

export type Climate = "desert" | "tropical" | "temperate" | "polar";

export type WorldCity = {
  id: string;
  name: string;
  country: string;
  latitude: number;
  longitude: number;
  climate: Climate;
};

export const WORLD_CITIES: WorldCity[] = [
  { id: "new-york", name: "New York", country: "US", latitude: 40.71, longitude: -74.01, climate: "temperate" },
  { id: "london", name: "London", country: "GB", latitude: 51.51, longitude: -0.13, climate: "temperate" },
  { id: "paris", name: "Paris", country: "FR", latitude: 48.86, longitude: 2.35, climate: "temperate" },
  { id: "tokyo", name: "Tokyo", country: "JP", latitude: 35.68, longitude: 139.69, climate: "temperate" },
  { id: "sydney", name: "Sydney", country: "AU", latitude: -33.87, longitude: 151.21, climate: "temperate" },
  { id: "dubai", name: "Dubai", country: "AE", latitude: 25.2, longitude: 55.27, climate: "desert" },
  { id: "reykjavik", name: "Reykjavík", country: "IS", latitude: 64.15, longitude: -21.94, climate: "polar" },
  { id: "singapore", name: "Singapore", country: "SG", latitude: 1.35, longitude: 103.82, climate: "tropical" },
];

/**
 * The square cards are coloured by climate alone: not by condition, not by
 * temperature. A grid where every card responds to its own weather becomes a
 * fruit salad, and the thing worth seeing at a glance is that these places are
 * different kinds of places. Condition takes over once a card is opened, where
 * there is only one of them (Decisions Log 102).
 *
 * Stops run dark to mid, and every one is checked against the text that sits on
 * it in `cities.test.ts`. The palette lesson from the hero applies here too:
 * colour chosen for looks and never checked is how text becomes unreadable.
 */
export const CLIMATE_GRADIENT: Record<Climate, [string, string, string]> = {
  // Sand and low sun.
  desert: ["#3b2f1d", "#6d5629", "#6a572e"],
  // Wet green, deliberately deep rather than lime.
  tropical: ["#16301f", "#2c5638", "#37624a"],
  // The neutral case, and the majority: grey with a trace of blue.
  temperate: ["#242a30", "#414c58", "#4d5763"],
  // Cold light. Still grey, but colder than temperate so it reads apart.
  polar: ["#232b33", "#3c4c5c", "#495c6d"],
};

export const CLIMATE_LABEL: Record<Climate, string> = {
  desert: "Desert",
  tropical: "Tropical",
  temperate: "Temperate",
  polar: "Subarctic",
};

/** The query Open-Meteo needs: every city in one request. */
export function cityCoordinates(): { latitudes: string; longitudes: string } {
  return {
    latitudes: WORLD_CITIES.map((city) => city.latitude).join(","),
    longitudes: WORLD_CITIES.map((city) => city.longitude).join(","),
  };
}
