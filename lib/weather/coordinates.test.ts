import { describe, expect, it } from "vitest";

import { parseCoordinates } from "./coordinates";
import { WeatherError } from "./errors";

function params(query: string): URLSearchParams {
  return new URLSearchParams(query);
}

describe("parseCoordinates", () => {
  it("parses a valid pair", () => {
    expect(parseCoordinates(params("lat=43.54&lon=-80.25"))).toEqual({
      latitude: 43.54,
      longitude: -80.25,
    });
  });

  it("rejects a missing or blank value as a bad request", () => {
    expect(() => parseCoordinates(params("lon=-80.25"))).toThrow(WeatherError);
    expect(() => parseCoordinates(params("lat=&lon=-80.25"))).toThrow(
      /Missing latitude/,
    );
  });

  it("rejects values outside the real coordinate range", () => {
    expect(() => parseCoordinates(params("lat=91&lon=0"))).toThrow(
      /latitude is out of range/,
    );
    expect(() => parseCoordinates(params("lat=0&lon=181"))).toThrow(
      /longitude is out of range/,
    );
  });

  it("rejects text, which Number would otherwise turn into NaN", () => {
    expect(() => parseCoordinates(params("lat=here&lon=0"))).toThrow(
      /out of range/,
    );
  });

  it("maps to a 400, not a 500", () => {
    try {
      parseCoordinates(params(""));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as WeatherError).status).toBe(400);
    }
  });
});
