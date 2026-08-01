import type { CurrentConditions, HourlyPoint } from "@/lib/weather/types";
import { conditionInfo } from "@/lib/weather/openweather/conditions";

/**
 * Voice engine.
 *
 * A deterministic rules engine, not a model call: the same weather must always
 * produce the same sentence, it has to run offline from a cached payload, and
 * it must never invent a forecast (Decisions Log 62).
 *
 * Rules are ordered most specific first and the first match wins, so a day with
 * both a temperature swing and incoming rain leads with whichever is more
 * useful to know. A neutral sentence closes the list so there is always output.
 *
 * Framework-free and pure, so every branch is testable without rendering.
 */

export type VoiceInput = {
  current: CurrentConditions;
  hourly: HourlyPoint[];
  /** Location time, so "by noon" means noon where the weather is. */
  timeZone: string;
};

/** Rain at or above this is worth planning around. */
const WET_MM_H = 0.2;
/** Below this chance, precipitation is not worth mentioning as a certainty. */
const LIKELY_CHANCE = 55;

type Shape = {
  now: number;
  /** Warmest and coolest of the next 12 hours. */
  high: number;
  low: number;
  /** Positive means warming. */
  swing: number;
  hoursToRain: number | null;
  hoursToDry: number | null;
  /** Hours of rain in the next 12. */
  wetHours: number;
  heaviest: number;
  windKph: number;
  gustKph: number;
  humidity: number;
  bucket: string;
  /** Local hour, 0 to 23, at the location. */
  hour: number;
};

function localHour(time: number, timeZone: string): number {
  return Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(time),
  );
}

/** "around 4", "by noon", "this evening" from an hour offset. */
function whenPhrase(hoursAhead: number, fromHour: number): string {
  if (hoursAhead <= 1) return "within the hour";

  const at = (fromHour + hoursAhead) % 24;

  if (at === 12) return "by noon";
  if (at >= 5 && at < 12) return `around ${at}am`;
  if (at === 0) return "around midnight";
  if (at > 12) return `around ${at - 12}pm`;

  return `in ${hoursAhead} hours`;
}

function describe(input: VoiceInput): Shape {
  const window_ = input.hourly.slice(0, 12);
  const temps = window_.map((hour) => hour.temperature);

  const wet = (hour: HourlyPoint) =>
    hour.precipitation >= WET_MM_H || hour.precipitationChance >= LIKELY_CHANCE;

  const firstWet = window_.findIndex(wet);
  const startsWet = window_.length > 0 && wet(window_[0]);
  const firstDry = startsWet ? window_.findIndex((hour) => !wet(hour)) : -1;

  return {
    now: input.current.temperature,
    high: temps.length ? Math.max(...temps) : input.current.temperature,
    low: temps.length ? Math.min(...temps) : input.current.temperature,
    swing: temps.length ? temps[temps.length - 1] - input.current.temperature : 0,
    hoursToRain: startsWet || firstWet === -1 ? null : firstWet,
    hoursToDry: firstDry === -1 ? null : firstDry,
    wetHours: window_.filter(wet).length,
    heaviest: window_.reduce((max, hour) => Math.max(max, hour.precipitation), 0),
    windKph: input.current.wind.speed,
    gustKph: input.current.wind.gust ?? input.current.wind.speed,
    humidity: input.current.humidity,
    bucket: conditionInfo(input.current.condition.code).bucket,
    hour: localHour(input.current.observedAt, input.timeZone),
  };
}

type Rule = { id: string; when: (s: Shape) => boolean; say: (s: Shape) => string };

/**
 * Ordered most specific first. Roughly forty branches across severity,
 * precipitation timing, temperature swing, wind and humidity.
 */
const RULES: Rule[] = [
  // ---- Severe and unusual ------------------------------------------------
  {
    id: "storm-now",
    when: (s) => s.bucket === "thunderstorm",
    say: () => "Thunderstorms overhead. Stay in, and off high ground.",
  },
  {
    id: "storm-later",
    when: (s) => s.bucket !== "thunderstorm" && s.heaviest >= 7.6,
    say: (s) =>
      `Heavy rain building ${whenPhrase(s.hoursToRain ?? 1, s.hour)}. Worth moving plans earlier.`,
  },
  {
    id: "snow-now",
    when: (s) => s.bucket === "snow" && s.wetHours >= 4,
    say: () => "Snow settling in for the next few hours. Give yourself extra time.",
  },
  {
    id: "snow-light",
    when: (s) => s.bucket === "snow",
    say: () => "Light snow around. Nothing that should hold you up.",
  },
  {
    id: "fog",
    when: (s) => s.bucket === "fog",
    say: () => "Thick air and low visibility. Slow going if you are driving.",
  },
  {
    id: "gale",
    when: (s) => s.gustKph >= 60,
    say: (s) => `Gusts to ${Math.round(s.gustKph)}. Anything loose outside will move.`,
  },

  // ---- Freezing ----------------------------------------------------------
  {
    id: "hard-freeze",
    when: (s) => s.now <= -10,
    say: () => "Properly cold. Cover everything that will be exposed.",
  },
  {
    id: "freeze-thawing",
    when: (s) => s.now <= 0 && s.high > 2,
    say: () => "Below freezing now, above by afternoon. Ice early, wet later.",
  },
  {
    id: "freezing",
    when: (s) => s.now <= 0,
    say: () => "Below freezing and staying there. Layers, and watch for ice.",
  },
  {
    id: "frost-coming",
    when: (s) => s.now > 0 && s.low <= 0,
    say: () => "Dropping below freezing later. Bring in anything that minds a frost.",
  },

  // ---- Precipitation timing ---------------------------------------------
  {
    id: "rain-arriving-soon",
    when: (s) => s.hoursToRain !== null && s.hoursToRain <= 2,
    say: (s) =>
      s.heaviest >= 2.5
        ? `Rain ${whenPhrase(s.hoursToRain!, s.hour)}, and not light. Take the coat.`
        : `Rain ${whenPhrase(s.hoursToRain!, s.hour)}. Light, but enough to notice.`,
  },
  {
    id: "rain-arriving-and-staying",
    when: (s) => s.hoursToRain !== null && s.wetHours >= 6,
    say: (s) =>
      `Rain arriving ${whenPhrase(s.hoursToRain!, s.hour)}. Nothing heavy, but it stays all evening.`,
  },
  {
    id: "rain-arriving",
    when: (s) => s.hoursToRain !== null,
    say: (s) => `Dry until ${whenPhrase(s.hoursToRain!, s.hour)}, then rain moves in.`,
  },
  {
    id: "rain-clearing-soon",
    when: (s) => s.hoursToDry !== null && s.hoursToDry <= 2,
    say: (s) =>
      `Rain easing ${s.hoursToDry === 1 ? "within the hour" : `in ${s.hoursToDry} hours`}. Worth waiting out.`,
  },
  {
    id: "rain-clearing",
    when: (s) => s.hoursToDry !== null,
    say: (s) => `Wet now, drying out ${whenPhrase(s.hoursToDry!, s.hour)}.`,
  },
  {
    id: "rain-all-day",
    when: (s) => s.wetHours >= 10,
    say: () => "Rain the whole way through. No real window in it.",
  },
  {
    id: "rain-persistent",
    when: (s) => s.wetHours >= 5,
    say: () => "On and off rain for most of the day. Keep something waterproof close.",
  },

  // ---- Temperature movement ---------------------------------------------
  {
    id: "cool-warming-fast",
    when: (s) => s.swing >= 6 && s.now <= 12,
    say: () => "Cool start, warming fast. Jacket now, gone by noon.",
  },
  {
    id: "warming",
    when: (s) => s.swing >= 6,
    say: (s) => `Climbing ${Math.round(s.swing)} degrees through the day. Dress for the afternoon.`,
  },
  {
    id: "cooling-sharply",
    when: (s) => s.swing <= -8,
    say: (s) => `Dropping ${Math.abs(Math.round(s.swing))} degrees by tonight. Warmer than it will feel later.`,
  },
  {
    id: "cooling",
    when: (s) => s.swing <= -5,
    say: () => "Mild now, noticeably colder by evening. Take the extra layer.",
  },

  // ---- Heat and humidity -------------------------------------------------
  {
    id: "hot-humid",
    when: (s) => s.now >= 28 && s.humidity >= 65,
    say: () => "Hot and heavy air. It will feel worse than the number suggests.",
  },
  {
    id: "hot",
    when: (s) => s.now >= 28,
    say: () => "Genuinely hot. Shade and water if you are out for long.",
  },
  {
    id: "warm-humid",
    when: (s) => s.now >= 22 && s.humidity >= 75,
    say: () => "Warm and sticky. Nothing extreme, just close.",
  },
  {
    id: "very-dry",
    when: (s) => s.humidity <= 25 && s.now >= 15,
    say: () => "Very dry air. Fine outside, harsh on the skin.",
  },

  // ---- Wind --------------------------------------------------------------
  {
    id: "windy-cold",
    when: (s) => s.windKph >= 35 && s.now <= 8,
    say: () => "Cold with a real wind behind it. It will bite more than the reading.",
  },
  {
    id: "windy",
    when: (s) => s.windKph >= 35,
    say: () => "Blustery all day. Hold onto anything light.",
  },
  {
    id: "breezy",
    when: (s) => s.windKph >= 22,
    say: () => "A steady breeze, otherwise unremarkable.",
  },

  // ---- Pleasant ----------------------------------------------------------
  {
    id: "clear-and-mild",
    when: (s) =>
      s.bucket === "clear" && s.now >= 16 && s.now <= 26 && s.wetHours === 0,
    say: () => "About as good as it gets. Nothing in the way of being outside.",
  },
  {
    id: "clear-cool",
    when: (s) => s.bucket === "clear" && s.now < 16 && s.wetHours === 0,
    say: () => "Clear and cool. Bright, but keep a layer on.",
  },
  {
    id: "clear-night",
    when: (s) => s.bucket === "clear" && (s.hour >= 20 || s.hour < 5),
    say: () => "Clear overnight. Expect it to be colder than it looks.",
  },
  {
    id: "overcast-mild",
    when: (s) => s.bucket === "overcast" && s.wetHours === 0,
    say: () => "Grey but dry. Nothing that needs planning around.",
  },
  {
    id: "partly-cloudy",
    when: (s) => s.bucket === "partlyCloudy" && s.wetHours === 0,
    say: () => "Mixed sun and cloud, staying dry. An easy one.",
  },
];

/** Last resort. Always true, so `voiceLine` can never return nothing. */
function neutral(shape: Shape): string {
  return `Around ${Math.round(shape.now)} degrees and steady. Nothing much to plan around.`;
}

export function voiceLine(input: VoiceInput): string {
  const shape = describe(input);
  const rule = RULES.find((candidate) => candidate.when(shape));

  return rule ? rule.say(shape) : neutral(shape);
}

/** Exposed so a test can assert every rule is reachable and worded well. */
export const VOICE_RULE_IDS = RULES.map((rule) => rule.id);
