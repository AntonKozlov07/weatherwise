import type { Coordinates } from "./weather/coordinates";

/**
 * Where the app looks before onboarding exists.
 *
 * Onboarding step 3 captures the real location in phase 5, and saved locations
 * land there too. Until then the home screen needs somewhere to point, and
 * asking for the geolocation permission with no onboarding context to explain
 * it is the wrong first impression (Decisions Log 24).
 */
export const DEFAULT_LOCATION: Coordinates = {
  latitude: 43.5448,
  longitude: -80.2482,
};
