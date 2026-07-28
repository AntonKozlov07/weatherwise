import { WeatherError } from "./errors";

export type Coordinates = { latitude: number; longitude: number };

function parseCoordinate(
  raw: string | null,
  name: string,
  limit: number,
): number {
  if (raw === null || raw.trim() === "") {
    throw new WeatherError("bad_request", `Missing ${name}.`);
  }

  const value = Number(raw);

  if (!Number.isFinite(value) || Math.abs(value) > limit) {
    throw new WeatherError("bad_request", `${name} is out of range.`);
  }

  return value;
}

export function parseCoordinates(params: URLSearchParams): Coordinates {
  return {
    latitude: parseCoordinate(params.get("lat"), "latitude", 90),
    longitude: parseCoordinate(params.get("lon"), "longitude", 180),
  };
}
