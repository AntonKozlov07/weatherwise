/**
 * A precipitation map of the future, built from point forecasts.
 *
 * The radar layers show the past. RainViewer publishes two hours behind and
 * currently no nowcast at all, and OpenWeatherMap's tiles are a snapshot of
 * now, so the map answered "did it rain" when the only question worth opening a
 * map for is "is it coming here" (Decisions Log 116).
 *
 * No vendor sells a forecast tile we can reach, so the map is drawn rather than
 * fetched: a grid of points around you, each with its own hourly forecast, one
 * request, rendered as a heatmap. Coarse by construction, around fifty
 * kilometres between samples, which is useless for a street and right for a
 * front moving across a region.
 *
 * The trade is honest and worth naming: this is interpolation between forecast
 * points, not observed radar. It cannot show a shower that fits between two
 * samples. What it can do, which radar cannot, is show tomorrow.
 */

/** Points per side. 7 by 7 is 49, inside one request and quick to draw. */
export const GRID_SIDE = 7;
/** Degrees of latitude between samples, about 50km. */
export const GRID_STEP_DEG = 0.45;

export type GridPoint = {
  latitude: number;
  longitude: number;
  /** mm of precipitation, one per hour, aligned to `times`. */
  precipitation: number[];
};

export type ForecastGrid = {
  /** Epoch millis per hour, shared by every point. */
  times: number[];
  points: GridPoint[];
  /** The heaviest hour anywhere on the grid, for scaling the render. */
  peak: number;
};

/**
 * Grid coordinates around a centre.
 *
 * Longitude spacing is divided by the cosine of the latitude so the cells stay
 * roughly square on the ground. Without it the grid stretches east to west as
 * you move away from the equator, and at Reykjavík it would be twice as wide as
 * it is tall.
 */
export function gridCoordinates(
  latitude: number,
  longitude: number,
): { latitudes: number[]; longitudes: number[] } {
  const half = Math.floor(GRID_SIDE / 2);
  const lonStep = GRID_STEP_DEG / Math.max(0.2, Math.cos((latitude * Math.PI) / 180));

  const latitudes: number[] = [];
  const longitudes: number[] = [];

  for (let row = -half; row <= half; row += 1) {
    for (let column = -half; column <= half; column += 1) {
      latitudes.push(Number((latitude + row * GRID_STEP_DEG).toFixed(3)));
      longitudes.push(Number((longitude + column * lonStep).toFixed(3)));
    }
  }

  return { latitudes, longitudes };
}

type RawPoint = {
  latitude?: unknown;
  longitude?: unknown;
  utc_offset_seconds?: unknown;
  hourly?: { time?: unknown; precipitation?: unknown };
};

/**
 * Parses the multi-point response.
 *
 * Times come from the first point that has them and are shared: every point in
 * one request covers the same hours, and holding 49 copies of the same array
 * would be most of the payload.
 */
export function parseForecastGrid(
  payload: unknown,
  /**
   * Hours before this are dropped. Open-Meteo returns whole days, so the
   * response begins at midnight and the first third of it is already over. On a
   * layer whose whole purpose is to look forward, starting in the past is the
   * exact complaint it was built to answer (Decisions Log 116).
   */
  now: number = Date.now(),
): ForecastGrid | null {
  const rows = Array.isArray(payload) ? (payload as RawPoint[]) : null;
  if (!rows || rows.length === 0) return null;

  let times: number[] | null = null;
  const points: GridPoint[] = [];
  let peak = 0;

  for (const row of rows) {
    const rawTimes = Array.isArray(row.hourly?.time) ? row.hourly.time : null;
    const rawRain = Array.isArray(row.hourly?.precipitation)
      ? row.hourly.precipitation
      : null;

    if (!rawTimes || !rawRain) continue;
    if (typeof row.latitude !== "number" || typeof row.longitude !== "number") continue;

    if (!times) {
      const offset =
        typeof row.utc_offset_seconds === "number" ? row.utc_offset_seconds : 0;

      // Local wall clock with no offset attached, the same shape that made the
      // world board show Tokyo nine hours out (Decisions Log 108).
      times = rawTimes
        .filter((time): time is string => typeof time === "string")
        .map((time) => Date.parse(`${time}Z`) - offset * 1000);
    }

    const precipitation = rawRain.map((value) =>
      typeof value === "number" && Number.isFinite(value) ? value : 0,
    );

    for (const value of precipitation) peak = Math.max(peak, value);

    points.push({
      latitude: row.latitude,
      longitude: row.longitude,
      precipitation,
    });
  }

  if (!times || points.length === 0) return null;

  /*
    Strictly greater, so an hour that has fully elapsed is dropped and the one
    in progress is kept: at exactly the top of the hour, the previous hour is
    over and has nothing left to say. Written as `>=` first, which kept one
    finished hour on the front of a layer built to look forward.
  */
  const from = times.findIndex((time) => time > now - 3_600_000);
  if (from === -1) return null;

  if (from > 0) {
    times = times.slice(from);

    for (const point of points) {
      point.precipitation = point.precipitation.slice(from);
    }

    peak = points.reduce(
      (max, point) => Math.max(max, ...point.precipitation),
      0,
    );
  }

  return { times, points, peak };
}

export type GridFeatureCollection = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: { value: number };
  }[];
};

/**
 * One hour of the grid, as GeoJSON for a heatmap layer.
 *
 * Dry points are dropped rather than included at zero. A heatmap weights every
 * feature it is given, and a full grid of zeroes still tints the map, which
 * would show drizzle everywhere on a clear day.
 */
export function gridAtHour(grid: ForecastGrid, hour: number): GridFeatureCollection {
  const index = Math.max(0, Math.min(grid.times.length - 1, hour));

  return {
    type: "FeatureCollection",
    features: grid.points
      .map((point) => ({ point, value: point.precipitation[index] ?? 0 }))
      .filter(({ value }) => value >= 0.1)
      .map(({ point, value }) => ({
        type: "Feature" as const,
        geometry: {
          type: "Point" as const,
          coordinates: [point.longitude, point.latitude] as [number, number],
        },
        // Square-rooted for the same reason the timeline's bars are: linear
        // weighting makes drizzle invisible beside a downpour.
        properties: { value: Math.sqrt(value) },
      })),
  };
}

/** Hours from now that actually have rain somewhere, for the scrubber. */
export function wetHours(grid: ForecastGrid): number[] {
  return grid.times
    .map((_, index) =>
      grid.points.some((point) => (point.precipitation[index] ?? 0) >= 0.1) ? index : -1,
    )
    .filter((index) => index !== -1);
}
