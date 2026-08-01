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
  /** How far a second, independent model agrees. Null where not compared. */
  confidence: "high" | "moderate" | "low" | null;
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
  confidence: VoiceDigest["confidence"] = null,
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
    confidence,
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
 * One paragraph of exactly three sentences rather than three separate fields.
 * The card used to carry a line, a clothing note and an activity note as three
 * labelled rows, which read as a form. A paragraph reads as somebody telling
 * you about the day (Decisions Log 104).
 */
export const SYSTEM_PROMPT = `You write one paragraph for a weather app's home screen. Reply with JSON only:
{"paragraph":"..."}

Exactly three sentences, in this order:
1. What today is actually like, and whether that is good or bad.
2. What to wear. Concrete garments, not "dress warmly".
3. What the conditions mean for being outside, and when.

Voice: a person who knows the area telling you about the day. Dry, specific, a little wry. Never cheerful, never a forecast read aloud.

Rules:
- Use ONLY numbers present in the data. Never state a temperature, time or measurement you were not given.
- Never invent rain, wind or conditions not in the data.
- Under 300 characters total. No emoji, no exclamation marks, no greetings.
- Do not mention the data, the app, or yourself.

Example:
{"paragraph":"Cool start, warming fast, and the kind of day worth getting outside for. Light jacket over a t-shirt, though you will want it off by lunch. Best run is the morning, before it climbs into the twenties."}`;

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

  // Two independent models disagreeing is worth a hedge in the wording rather
  // than a badge on the screen, so the confidence arrives as a fact about the
  // forecast and the model chooses how to say it (Decisions Log 99).
  if (digest.confidence === "low") {
    lines.push("Note: two forecast models disagree about today. Hedge accordingly.");
  }

  return lines.join("\n");
}
