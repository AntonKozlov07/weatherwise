/**
 * OpenWeatherMap Weather Maps 1.0 tile layers.
 *
 * 1.0 deliberately, not 2.0: the 2.0 endpoints are paid (CLAUDE.md data source
 * table). These work with the same free key as the rest of the OWM surface.
 *
 * Tiles are served through our own route handler, because a tile URL template
 * lives in the browser and the key must not.
 */

export const WEATHER_TILE_LAYERS = ["precipitation", "wind"] as const;

export type WeatherTileLayer = (typeof WEATHER_TILE_LAYERS)[number];

/** OWM's layer identifiers. `_new` is the 1.0 naming, not a newer version. */
const OWM_LAYER_ID: Record<WeatherTileLayer, string> = {
  precipitation: "precipitation_new",
  wind: "wind_new",
};

export function isWeatherTileLayer(value: string): value is WeatherTileLayer {
  return (WEATHER_TILE_LAYERS as readonly string[]).includes(value);
}

export function owmLayerId(layer: WeatherTileLayer): string {
  return OWM_LAYER_ID[layer];
}

/** The template MapLibre expands per tile, pointed at our proxy. */
export function tileTemplate(origin: string, layer: WeatherTileLayer): string {
  return `${origin}/api/tiles/${layer}/{z}/{x}/{y}`;
}

/** OWM's 1.0 tiles are 256px and stop being useful past this zoom. */
export const TILE_SIZE = 256;
export const MAX_TILE_ZOOM = 12;
