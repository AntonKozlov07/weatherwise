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
  /**
   * Drawn as a card on the board. Every city is ranked; only these are shown,
   * because fifty squares is a directory rather than a glance
   * (Decisions Log 114).
   */
  featured?: boolean;
};

export const WORLD_CITIES: WorldCity[] = [
  { id: "new-york", name: "New York", country: "US", latitude: 40.71, longitude: -74.01, climate: "temperate", featured: true },
  { id: "london", name: "London", country: "GB", latitude: 51.51, longitude: -0.13, climate: "temperate", featured: true },
  { id: "paris", name: "Paris", country: "FR", latitude: 48.86, longitude: 2.35, climate: "temperate", featured: true },
  { id: "tokyo", name: "Tokyo", country: "JP", latitude: 35.68, longitude: 139.69, climate: "temperate", featured: true },
  { id: "sydney", name: "Sydney", country: "AU", latitude: -33.87, longitude: 151.21, climate: "temperate", featured: true },
  { id: "dubai", name: "Dubai", country: "AE", latitude: 25.2, longitude: 55.27, climate: "desert", featured: true },
  { id: "reykjavik", name: "Reykjavík", country: "IS", latitude: 64.15, longitude: -21.94, climate: "polar", featured: true },
  { id: "singapore", name: "Singapore", country: "SG", latitude: 1.35, longitude: 103.82, climate: "tropical", featured: true },
  { id: "cairo", name: "Cairo", country: "EG", latitude: 30.04, longitude: 31.24, climate: "desert" },
  { id: "warsaw", name: "Warsaw", country: "PL", latitude: 52.23, longitude: 21.01, climate: "temperate" },
  { id: "rio", name: "Rio de Janeiro", country: "BR", latitude: -22.91, longitude: -43.17, climate: "tropical" },
  { id: "cape-town", name: "Cape Town", country: "ZA", latitude: -33.92, longitude: 18.42, climate: "temperate" },
  { id: "mumbai", name: "Mumbai", country: "IN", latitude: 19.08, longitude: 72.88, climate: "tropical" },
  { id: "mexico-city", name: "Mexico City", country: "MX", latitude: 19.43, longitude: -99.13, climate: "temperate" },
  { id: "anchorage", name: "Anchorage", country: "US", latitude: 61.22, longitude: -149.9, climate: "polar" },
  { id: "phoenix", name: "Phoenix", country: "US", latitude: 33.45, longitude: -112.07, climate: "desert" },
  { id: "los-angeles", name: "Los Angeles", country: "US", latitude: 34.05, longitude: -118.24, climate: "temperate" },
  { id: "chicago", name: "Chicago", country: "US", latitude: 41.88, longitude: -87.63, climate: "temperate" },
  { id: "toronto", name: "Toronto", country: "CA", latitude: 43.65, longitude: -79.38, climate: "temperate" },
  { id: "vancouver", name: "Vancouver", country: "CA", latitude: 49.28, longitude: -123.12, climate: "temperate" },
  { id: "bogota", name: "Bogotá", country: "CO", latitude: 4.71, longitude: -74.07, climate: "temperate" },
  { id: "lima", name: "Lima", country: "PE", latitude: -12.05, longitude: -77.04, climate: "desert" },
  { id: "santiago", name: "Santiago", country: "CL", latitude: -33.45, longitude: -70.67, climate: "temperate" },
  { id: "buenos-aires", name: "Buenos Aires", country: "AR", latitude: -34.6, longitude: -58.38, climate: "temperate" },
  { id: "ushuaia", name: "Ushuaia", country: "AR", latitude: -54.8, longitude: -68.3, climate: "polar" },
  { id: "madrid", name: "Madrid", country: "ES", latitude: 40.42, longitude: -3.7, climate: "temperate" },
  { id: "rome", name: "Rome", country: "IT", latitude: 41.9, longitude: 12.5, climate: "temperate" },
  { id: "berlin", name: "Berlin", country: "DE", latitude: 52.52, longitude: 13.4, climate: "temperate" },
  { id: "stockholm", name: "Stockholm", country: "SE", latitude: 59.33, longitude: 18.07, climate: "polar" },
  { id: "helsinki", name: "Helsinki", country: "FI", latitude: 60.17, longitude: 24.94, climate: "polar" },
  { id: "istanbul", name: "Istanbul", country: "TR", latitude: 41.01, longitude: 28.98, climate: "temperate" },
  { id: "athens", name: "Athens", country: "GR", latitude: 37.98, longitude: 23.73, climate: "temperate" },
  { id: "lisbon", name: "Lisbon", country: "PT", latitude: 38.72, longitude: -9.14, climate: "temperate" },
  { id: "dublin", name: "Dublin", country: "IE", latitude: 53.35, longitude: -6.26, climate: "temperate" },
  { id: "lagos", name: "Lagos", country: "NG", latitude: 6.52, longitude: 3.38, climate: "tropical" },
  { id: "nairobi", name: "Nairobi", country: "KE", latitude: -1.29, longitude: 36.82, climate: "tropical" },
  { id: "marrakesh", name: "Marrakesh", country: "MA", latitude: 31.63, longitude: -7.99, climate: "desert" },
  { id: "addis-ababa", name: "Addis Ababa", country: "ET", latitude: 9.03, longitude: 38.74, climate: "temperate" },
  { id: "riyadh", name: "Riyadh", country: "SA", latitude: 24.71, longitude: 46.68, climate: "desert" },
  { id: "tehran", name: "Tehran", country: "IR", latitude: 35.69, longitude: 51.39, climate: "desert" },
  { id: "karachi", name: "Karachi", country: "PK", latitude: 24.86, longitude: 67.01, climate: "desert" },
  { id: "delhi", name: "Delhi", country: "IN", latitude: 28.61, longitude: 77.21, climate: "desert" },
  { id: "bangkok", name: "Bangkok", country: "TH", latitude: 13.76, longitude: 100.5, climate: "tropical" },
  { id: "jakarta", name: "Jakarta", country: "ID", latitude: -6.21, longitude: 106.85, climate: "tropical" },
  { id: "manila", name: "Manila", country: "PH", latitude: 14.6, longitude: 120.98, climate: "tropical" },
  { id: "hong-kong", name: "Hong Kong", country: "HK", latitude: 22.32, longitude: 114.17, climate: "tropical" },
  { id: "beijing", name: "Beijing", country: "CN", latitude: 39.9, longitude: 116.41, climate: "temperate" },
  { id: "seoul", name: "Seoul", country: "KR", latitude: 37.57, longitude: 126.98, climate: "temperate" },
  { id: "auckland", name: "Auckland", country: "NZ", latitude: -36.85, longitude: 174.76, climate: "temperate" },
  { id: "perth", name: "Perth", country: "AU", latitude: -31.95, longitude: 115.86, climate: "temperate" },
];

/** The eight drawn as cards. The rest exist to make the ranking mean something. */
export const FEATURED_CITIES = WORLD_CITIES.filter((city) => city.featured);

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
