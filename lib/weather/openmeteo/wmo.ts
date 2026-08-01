/**
 * WMO weather codes to OpenWeatherMap codes.
 *
 * Open-Meteo reports the WMO standard; every piece of theming, bucketing, icon
 * selection and labelling in this app is keyed to OpenWeatherMap's own
 * numbering. Rather than build a second parallel system for world cities, the
 * codes are translated once here and everything downstream carries on unchanged
 * (Decisions Log 101).
 *
 * The mapping is lossy in one direction only, which is the safe one: WMO is
 * coarser, so several WMO codes land on the same OWM code and none of them
 * needs a distinction OWM cannot express.
 *
 * Freezing drizzle and freezing rain both map to 511. OWM has one code for the
 * pair, and the difference does not change what the app draws or says.
 */

const WMO_TO_OWM: Record<number, number> = {
  // Clear and cloud
  0: 800, // Clear sky
  1: 801, // Mainly clear
  2: 802, // Partly cloudy
  3: 804, // Overcast

  // Fog
  45: 741,
  48: 741, // Depositing rime fog

  // Drizzle
  51: 300,
  53: 301,
  55: 302,

  // Freezing drizzle
  56: 511,
  57: 511,

  // Rain
  61: 500,
  63: 501,
  65: 502,

  // Freezing rain
  66: 511,
  67: 511,

  // Snow
  71: 600,
  73: 601,
  75: 602,
  77: 600, // Snow grains

  // Rain showers
  80: 520,
  81: 521,
  82: 522,

  // Snow showers
  85: 620,
  86: 622,

  // Thunderstorm
  95: 200,
  96: 202, // With slight hail
  99: 202, // With heavy hail
};

/**
 * Falls back to clear rather than throwing.
 *
 * An unrecognised code is a vendor adding one, not a fault worth failing a
 * screen for, and clear is the least alarming thing to show for a city on the
 * far side of the world.
 */
export function wmoToOwm(code: number): number {
  return WMO_TO_OWM[code] ?? 800;
}

/** Every WMO code this app knows how to translate. For tests. */
export const KNOWN_WMO_CODES = Object.keys(WMO_TO_OWM).map(Number);
