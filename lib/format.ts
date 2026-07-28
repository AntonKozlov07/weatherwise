/**
 * Formatting helpers. Every one takes the location's IANA zone, because the
 * saved location is often not where the phone is: a forecast for Vancouver has
 * to read in Vancouver's hours.
 *
 * Values arriving here are always metric (Decisions Log 18). The units
 * parameter is a formatting choice and defaults to metric (Decisions Log 8).
 */

export type Units = "metric" | "imperial";

const cache = new Map<string, Intl.DateTimeFormat>();

function formatter(
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${timeZone}|${JSON.stringify(options)}`;
  let existing = cache.get(key);

  if (!existing) {
    existing = new Intl.DateTimeFormat("en-CA", { timeZone, ...options });
    cache.set(key, existing);
  }

  return existing;
}

/**
 * "2pm", matching the Figma's compact hour labels.
 *
 * en-CA renders the period as "p.m.", so spaces and dots are both stripped
 * rather than just spaces.
 */
export function formatHour(time: number, timeZone: string): string {
  return formatter(timeZone, { hour: "numeric", hour12: true })
    .format(time)
    .replace(/[\s.  ]/g, "")
    .toLowerCase();
}

/** "9:41 PM", for sunrise, sunset, and the moon rows. */
export function formatTime(time: number, timeZone: string): string {
  return formatter(timeZone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(time);
}

/** "November 1". */
export function formatLongDate(time: number, timeZone: string): string {
  return formatter(timeZone, { month: "long", day: "numeric" }).format(time);
}

/** "Monday", or "Today" when the day matches. */
export function formatDayName(
  time: number,
  timeZone: string,
  now: number = Date.now(),
): string {
  const dayKey = formatter(timeZone, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  if (dayKey.format(time) === dayKey.format(now)) return "Today";

  return formatter(timeZone, { weekday: "long" }).format(time);
}

export function celsiusToFahrenheit(celsius: number): number {
  return celsius * 1.8 + 32;
}

export function kphToMph(kph: number): number {
  return kph / 1.609344;
}

/** The bare number. The degree symbol is a separate span at 45% size. */
export function formatTemperature(
  celsius: number,
  units: Units = "metric",
): string {
  const value = units === "metric" ? celsius : celsiusToFahrenheit(celsius);
  return String(Math.round(value));
}

export function temperatureUnit(units: Units = "metric"): string {
  return units === "metric" ? "C" : "F";
}

export function formatWind(kph: number, units: Units = "metric"): string {
  return units === "metric"
    ? `${Math.round(kph)} km/h`
    : `${Math.round(kphToMph(kph))} mph`;
}

/** Minutes since a timestamp, as "Updated just now" / "Updated 12m ago". */
export function formatUpdatedAgo(
  observedAt: number,
  now: number = Date.now(),
): string {
  const minutes = Math.max(0, Math.round((now - observedAt) / 60_000));

  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  return `Updated ${hours}h ago`;
}

/**
 * Plain language UV severity. The Guide page explains the same bands, so the
 * wording has to agree with it.
 */
export function uvSeverity(index: number): string {
  if (index < 3) return "Low";
  if (index < 6) return "Moderate";
  if (index < 8) return "High";
  if (index < 11) return "Very high";
  return "Extreme";
}

/** US EPA index is 1 to 6, not the 0 to 500 AQI number. */
export function aqiSeverity(epaIndex: number): string {
  return (
    [
      "Good",
      "Moderate",
      "Unhealthy for sensitive groups",
      "Unhealthy",
      "Very unhealthy",
      "Hazardous",
    ][epaIndex - 1] ?? "Unknown"
  );
}

/** Humidity as the Figma phrases it, rather than a bare percentage. */
export function humidityLabel(humidity: number): string {
  if (humidity < 40) return "Low";
  if (humidity < 70) return "Low-Moderate";
  return "High";
}
