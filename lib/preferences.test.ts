import { describe, expect, it } from "vitest";

import {
  DEFAULT_PREFERENCES,
  activeLocation,
  locationId,
  parsePreferences,
  type SavedLocation,
} from "./preferences";

const GUELPH: SavedLocation = {
  id: "43.5448,-80.2482",
  name: "Guelph",
  region: "Ontario",
  country: "Canada",
  latitude: 43.5448,
  longitude: -80.2482,
};

function stored(preferences: Record<string, unknown>): string {
  return JSON.stringify(preferences);
}

describe("locationId", () => {
  it("is stable for the same place at differing precision", () => {
    expect(locationId(43.54481, -80.24819)).toBe(locationId(43.5448, -80.2482));
  });

  it("separates nearby but distinct places", () => {
    expect(locationId(43.55, -80.25)).not.toBe(locationId(43.5448, -80.2482));
  });
});

describe("parsePreferences", () => {
  it("returns defaults for nothing stored", () => {
    expect(parsePreferences(null)).toEqual(DEFAULT_PREFERENCES);
  });

  // localStorage is user-writable and outlives any one version of the app.
  it("returns defaults rather than throwing on corrupt JSON", () => {
    expect(parsePreferences("{not json")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("[]")).toEqual(DEFAULT_PREFERENCES);
    expect(parsePreferences("null")).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps recognised values and drops the rest", () => {
    const preferences = parsePreferences(
      stored({ units: "imperial", theme: "midnight", colour: "blue" }),
    );

    expect(preferences.units).toBe("imperial");
    expect(preferences.theme).toBe("midnight");
    expect(preferences).not.toHaveProperty("colour");
  });

  // A bad font size would otherwise leave the app at an unreadable root size.
  it("falls back on values outside the allowed set", () => {
    const preferences = parsePreferences(
      stored({ fontSize: "enormous", theme: "neon", units: 5 }),
    );

    expect(preferences.fontSize).toBe("medium");
    expect(preferences.theme).toBe("dark");
    expect(preferences.units).toBe("metric");
  });

  it("drops locations that are missing coordinates", () => {
    const preferences = parsePreferences(
      stored({ locations: [GUELPH, { name: "Nowhere" }, null, "Toronto"] }),
    );

    expect(preferences.locations).toEqual([GUELPH]);
  });

  it("backfills an id for a location stored without one", () => {
    const withoutId: Record<string, unknown> = { ...GUELPH };
    delete withoutId.id;

    const preferences = parsePreferences(stored({ locations: [withoutId] }));

    expect(preferences.locations[0].id).toBe(GUELPH.id);
  });

  // Otherwise the home screen points at a location that is no longer saved and
  // silently falls back to the default with no way to tell why.
  it("repoints an active id that no longer matches a saved location", () => {
    const preferences = parsePreferences(
      stored({ locations: [GUELPH], activeLocationId: "0,0" }),
    );

    expect(preferences.activeLocationId).toBe(GUELPH.id);
  });

  it("leaves the active id null when nothing is saved", () => {
    expect(parsePreferences(stored({ activeLocationId: "0,0" })).activeLocationId).toBeNull();
  });
});

describe("activeLocation", () => {
  it("resolves the active saved location", () => {
    const preferences = {
      ...DEFAULT_PREFERENCES,
      locations: [GUELPH],
      activeLocationId: GUELPH.id,
    };

    expect(activeLocation(preferences)).toEqual(GUELPH);
  });

  it("is null when nothing is active", () => {
    expect(activeLocation(DEFAULT_PREFERENCES)).toBeNull();
  });
});
