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

export const SYSTEM_PROMPT = `You write a single line for a weather app's home screen. One sentence, or two short ones. Never more.

Voice: a person who knows the area telling you what today is actually like. Dry, specific, a little wry. Never cheerful, never a forecast read aloud, never advice dressed as observation.

Hard rules:
- Use ONLY the numbers given to you. Never state a temperature, time, or measurement that is not in the data.
- Never invent precipitation, wind, or conditions that are not in the data.
- No greetings, no emoji, no exclamation marks, no hashtags.
- Do not mention that you are a model, or refer to the data, the app, or yourself.
- Do not use the words "today's forecast" or "currently".
- 140 characters maximum.

Good examples:
Cool start, warming fast. Jacket now, gone by noon.
Rain arriving around 4pm and staying for the evening.
Below freezing and staying there. Watch for ice underfoot.
Grey but dry. Nothing that needs planning around.

Reply with the line only. No quotes, no preamble.`;

export function userPrompt(digest: VoiceDigest): string {
  const lines = [
    `Temperature: ${digest.temperature}C, feels like ${digest.feelsLike}C`,
    `Condition: ${digest.condition}`,
    `Next 12 hours: high ${digest.high}C, low ${digest.low}C`,
    `Humidity: ${digest.humidity}%`,
    `Wind: ${digest.windKph} km/h, gusting ${digest.gustKph} km/h`,
    `UV index: ${digest.uvIndex}`,
    `Local hour: ${digest.hour}`,
  ];

  if (digest.hoursToRain !== null) {
    lines.push(`Rain starts in ${digest.hoursToRain} hour(s), heaviest ${digest.heaviestMmH} mm/h`);
  } else if (digest.hoursToDry !== null) {
    lines.push(`Raining now, stops in ${digest.hoursToDry} hour(s)`);
  } else if (digest.wetHours > 0) {
    lines.push(`${digest.wetHours} wet hours in the next 12`);
  } else {
    lines.push("No rain in the next 12 hours");
  }

  return lines.join("\n");
}
