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
  /** Light or dark right now, reported by the vendor rather than inferred. */
  isDay: boolean;
  /** Morning, afternoon, evening or night, in the location's own clock. */
  period: "morning" | "afternoon" | "evening" | "night";
  /** Hours until it gets dark, or null once it already is. */
  hoursToDark: number | null;
  /** Percent. Only the grey-day trigger reads this. */
  cloudCover: number;
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

/** The part of the day, as a person would name it. */
function periodOf(hour: number): VoiceDigest["period"] {
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}

export function buildDigest(
  current: CurrentConditions,
  hourly: HourlyPoint[],
  timeZone: string,
  confidence: VoiceDigest["confidence"] = null,
  sunset: number | null = null,
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
    isDay: current.condition.isDay,
    period: periodOf(localHour(current.observedAt, timeZone)),
    cloudCover: Math.round(current.cloudCover),
    hoursToDark:
      sunset !== null && sunset > current.observedAt
        ? Math.round((sunset - current.observedAt) / 3_600_000)
        : null,
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
- Where you are told what the reader dislikes about today, steer the advice around it and say when it eases. Nudge, do not announce: write "muggy out, worth waiting for the evening", never "you said you hate humidity".
- Where you are told which activities suit them, name only those. Never suggest one that is not on their list.
- Say nothing about a preference today does not set off.
- The third sentence must fit the time of day you are told. After dark, do not suggest sunbathing, a midday run, or anything needing daylight; talk about the evening, tomorrow morning, or staying in.
- Never use an em dash or an en dash. Commas, full stops or semicolons only.
- Use ONLY numbers present in the data. Never state a temperature, time or measurement you were not given.
- Never invent rain, wind or conditions not in the data.
- Under 300 characters total. No emoji, no exclamation marks, no greetings.
- Do not mention the data, the app, or yourself.

Example:
{"paragraph":"Cool start, warming fast, and the kind of day worth getting outside for. Light jacket over a t-shirt, though you will want it off by lunch. Best run is the morning, before it climbs into the twenties."}`;

export type PromptContext = {
  /** How today sets off what the reader dislikes, in plain phrases. */
  dislikes?: string[];
  /** Activities of theirs that today actually suits. */
  activities?: string[];
  /** Yesterday's paragraph, so today does not repeat it word for word. */
  previous?: string | null;
};

export function userPrompt(digest: VoiceDigest, context: PromptContext = {}): string {
  const lines = [
    // Time of day leads, because it governs what the third sentence may
    // suggest and the model was recommending a midday run at midnight
    // (Decisions Log 112).
    `It is ${digest.period} and it is ${digest.isDay ? "light" : "dark"} out.`,
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
  if (digest.hoursToDark !== null) {
    lines.push(`Dark in about ${digest.hoursToDark}h`);
  }

  if (digest.confidence === "low") {
    lines.push("Note: two forecast models disagree about today. Hedge accordingly.");
  }

  // Only triggered dislikes are sent. A profile that dislikes wind must not
  // produce a wind sentence on a still day, and the surest way to prevent that
  // is never to mention wind to the model at all (Decisions Log 117).
  if (context.dislikes?.length) {
    lines.push(`Today sets off ${context.dislikes.join(", and ")}.`);
  }

  if (context.activities?.length) {
    lines.push(
      `Activities they do that suit today: ${context.activities.join(", ")}.`,
    );
  }

  /*
    The last paragraph written here, so a run of identical days does not produce
    a run of identical sentences. The model is told to acknowledge the sameness
    rather than dress it up as news, which is the honest way to say the same
    thing twice (Decisions Log 118).
  */
  if (context.previous) {
    lines.push(
      `The last thing said here was: "${context.previous}" If today is much the same, say so plainly rather than repeating it; otherwise ignore this.`,
    );
  }

  return lines.join("\n");
}
