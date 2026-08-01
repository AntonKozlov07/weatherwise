import type { CurrentConditions, HourlyPoint } from "@/lib/weather/types";

/**
 * The forecast, reduced to what a one-line summary needs.
 *
 * Built here rather than sending the raw bundle for two reasons. The payload is
 * large and most of it is irrelevant to a sentence, and every number the model
 * is allowed to mention has to be one we can check afterwards. Whatever is not
 * in this digest cannot be validated, so it cannot be said.
 */

export type VoiceDigest = {
  temperature: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windKph: number;
  gustKph: number;
  uvIndex: number;
  /** Local hour at the location, 0 to 23. */
  hour: number;
  high: number;
  low: number;
  /** Hours from now until rain starts, or null if none is coming. */
  hoursToRain: number | null;
  /** Hours from now until it stops, or null if it is not raining. */
  hoursToDry: number | null;
  wetHours: number;
  heaviestMmH: number;
};

const WET_MM_H = 0.2;
const LIKELY_CHANCE = 55;

function localHour(time: number, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", { timeZone, hour: "numeric", hour12: false })
      .format(time),
  );
}

export function buildDigest(
  current: CurrentConditions,
  hourly: HourlyPoint[],
  timeZone: string,
): VoiceDigest {
  const window_ = hourly.slice(0, 12);
  const temps = window_.map((hour) => hour.temperature);

  const wet = (hour: HourlyPoint) =>
    hour.precipitation >= WET_MM_H || hour.precipitationChance >= LIKELY_CHANCE;

  const firstWet = window_.findIndex(wet);
  const startsWet = window_.length > 0 && wet(window_[0]);
  const firstDry = startsWet ? window_.findIndex((hour) => !wet(hour)) : -1;

  return {
    temperature: Math.round(current.temperature),
    feelsLike: Math.round(current.feelsLike),
    condition: current.condition.label,
    humidity: Math.round(current.humidity),
    windKph: Math.round(current.wind.speed),
    gustKph: Math.round(current.wind.gust ?? current.wind.speed),
    uvIndex: Math.round(current.uvIndex),
    hour: localHour(current.observedAt, timeZone),
    high: temps.length ? Math.round(Math.max(...temps)) : Math.round(current.temperature),
    low: temps.length ? Math.round(Math.min(...temps)) : Math.round(current.temperature),
    hoursToRain: startsWet || firstWet === -1 ? null : firstWet,
    hoursToDry: firstDry === -1 ? null : firstDry,
    wetHours: window_.filter(wet).length,
    heaviestMmH:
      Math.round(window_.reduce((max, hour) => Math.max(max, hour.precipitation), 0) * 10) /
      10,
  };
}

/**
 * A cache key that changes only when the answer would change.
 *
 * Rounded hard on purpose: a degree of drift or a percent of humidity does not
 * warrant a fresh sentence, and keying on the raw reading would mean a model
 * call on every poll for a line that would come back the same.
 */
export function digestKey(digest: VoiceDigest, latitude: number, longitude: number): string {
  return [
    latitude.toFixed(1),
    longitude.toFixed(1),
    digest.condition,
    Math.round(digest.temperature / 2) * 2,
    digest.hoursToRain ?? "-",
    digest.hoursToDry ?? "-",
    digest.wetHours,
    Math.round(digest.gustKph / 10) * 10,
    // Morning, afternoon, evening, night. Finer than this says nothing new.
    Math.floor(digest.hour / 6),
  ].join("|");
}

/**
 * The system prompt.
 *
 * Kept short on purpose. It is sent on every uncached call, so every sentence
 * here is paid for repeatedly, and the examples do more work than instructions
 * would (Decisions Log 90).
 *
 * Three fields in one response rather than three calls: the model has already
 * read the forecast, and asking it three times would triple the input tokens to
 * re-state what it was just told.
 */
export const SYSTEM_PROMPT = `You write copy for a weather app. Reply with JSON only:
{"line":"...","wear":"...","activity":"..."}

line: one sentence on what the day is actually like. Dry, specific, a little wry.
wear: what to put on. Concrete garments, not "dress warmly".
activity: a sport or outdoor activity that suits these conditions, and when.

Rules:
- Use ONLY numbers present in the data. Never state a temperature, time or measurement you were not given.
- Never invent rain, wind or conditions not in the data.
- Each field under 120 characters. No emoji, no exclamation marks, no greetings.
- Do not mention the data, the app, or yourself.

Example:
{"line":"Cool start, warming fast. Jacket now, gone by noon.","wear":"Light jacket over a t-shirt, you will want it off by lunch.","activity":"Good morning for a run before it warms up."}`;

export function userPrompt(digest: VoiceDigest): string {
  const lines = [
    `Now: ${digest.temperature}C, feels ${digest.feelsLike}C, ${digest.condition}`,
    `Next 12h: high ${digest.high}C, low ${digest.low}C`,
    `Humidity ${digest.humidity}%, wind ${digest.windKph} km/h, gusts ${digest.gustKph} km/h, UV ${digest.uvIndex}`,
    `Local hour: ${digest.hour}`,
  ];

  if (digest.hoursToRain !== null) {
    lines.push(`Rain in ${digest.hoursToRain}h, heaviest ${digest.heaviestMmH} mm/h`);
  } else if (digest.hoursToDry !== null) {
    lines.push(`Raining, stops in ${digest.hoursToDry}h`);
  } else {
    lines.push("No rain in the next 12h");
  }

  return lines.join("\n");
}
