import type { Astronomy, HourlyPoint } from "@/lib/weather/types";

/**
 * Golden hour and the UV peak.
 *
 * Two short lines for the hero, both answering a question the numbers on their
 * own do not: when is the light good, and when is the sun actually strong.
 *
 * Golden hour is a real interval, not a name for "evening": the hour after
 * sunrise and the hour before sunset, when the sun is low enough to warm the
 * light. Only the next one is offered, because a line about this morning's
 * light at four in the afternoon is trivia (Decisions Log 79).
 *
 * The UV line is deliberately not phrased as advice. It says when the sun is
 * strongest and how strong; what to do about that is the reader's business, and
 * a weather app telling someone how long to lie in the sun would be giving
 * health advice it is in no position to give.
 */

export type GoldenHour = {
  kind: "sunrise" | "sunset";
  start: number;
  end: number;
  /** True while it is happening rather than still ahead. */
  active: boolean;
};

const HOUR_MS = 60 * 60 * 1000;

/**
 * The next golden hour, or the current one.
 *
 * Null once both of today's have passed. The daily records carry later days'
 * sun times, but "golden hour is tomorrow at 6am" is not worth a line on a card
 * about right now.
 */
export function nextGoldenHour(
  astronomy: Astronomy,
  now: number,
): GoldenHour | null {
  const windows: GoldenHour[] = [];

  if (astronomy.sunrise !== null) {
    windows.push({
      kind: "sunrise",
      start: astronomy.sunrise,
      end: astronomy.sunrise + HOUR_MS,
      active: false,
    });
  }

  if (astronomy.sunset !== null) {
    windows.push({
      kind: "sunset",
      start: astronomy.sunset - HOUR_MS,
      end: astronomy.sunset,
      active: false,
    });
  }

  // Happening now wins over merely upcoming, whatever the order of the day.
  const current = windows.find((window) => now >= window.start && now <= window.end);
  if (current) return { ...current, active: true };

  return (
    windows
      .filter((window) => window.start > now)
      .sort((a, b) => a.start - b.start)[0] ?? null
  );
}

export type UvPeak = {
  /** When the strongest hour of the remaining day falls. */
  time: number;
  index: number;
  /** Plain-language band, matching the rest of the app's UV wording. */
  band: "low" | "moderate" | "high" | "very high" | "extreme";
  /** True where the peak is already behind us and the reading is falling. */
  past: boolean;
};

export function uvBand(index: number): UvPeak["band"] {
  if (index < 3) return "low";
  if (index < 6) return "moderate";
  if (index < 8) return "high";
  if (index < 11) return "very high";
  return "extreme";
}

/**
 * The strongest UV of the day ahead.
 *
 * Null below 3, where the reading is low enough that nobody needs to know, and
 * a line about it would be noise on every winter day and most cloudy ones.
 */
export function uvPeak(
  hourly: HourlyPoint[],
  now: number,
  /** How far ahead to look. The rest of today, near enough. */
  windowHours = 14,
): UvPeak | null {
  const ahead = hourly
    .filter((hour) => hour.time >= now - HOUR_MS)
    .slice(0, windowHours);

  if (ahead.length === 0) return null;

  const peak = ahead.reduce((best, hour) =>
    hour.uvIndex > best.uvIndex ? hour : best,
  );

  if (peak.uvIndex < 3) return null;

  return {
    time: peak.time,
    index: Math.round(peak.uvIndex),
    band: uvBand(peak.uvIndex),
    past: peak.time < now,
  };
}
