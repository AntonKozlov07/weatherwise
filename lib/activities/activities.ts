import type { CurrentConditions, HourlyPoint } from "@/lib/weather/types";
import { conditionInfo } from "@/lib/weather/openweather/conditions";

/**
 * Activity answers.
 *
 * Turns the forecast into verdicts on things people actually decide, rather
 * than making them read numbers and infer. Pure and deterministic, same as the
 * voice engine.
 *
 * Five are scored; the hero shows the three or four most relevant, because a
 * full list crowds the panel and dilutes the ones that matter (Decisions Log 63).
 */

export type Verdict = "good" | "caution" | "bad";

export type ActivityAnswer = {
  id: string;
  /** The question, as a person would ask it. */
  label: string;
  verdict: Verdict;
  /** Short answer, with a window where one is useful. */
  answer: string;
  /** Higher sorts first. Relevance, not quality of the verdict. */
  relevance: number;
};

const WET_MM_H = 0.2;
const LIKELY_CHANCE = 55;

function isWet(hour: HourlyPoint): boolean {
  return hour.precipitation >= WET_MM_H || hour.precipitationChance >= LIKELY_CHANCE;
}

/** "until 3pm" for the last dry hour, or null when it is wet now. */
function dryWindow(hourly: HourlyPoint[], timeZone: string): string | null {
  if (hourly.length === 0 || isWet(hourly[0])) return null;

  const firstWet = hourly.findIndex(isWet);
  if (firstWet === -1) return null;

  const at = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "numeric",
    hour12: true,
  })
    .format(hourly[firstWet].time)
    .replace(/[\s.]/g, "")
    .toLowerCase();

  return `until ${at}`;
}

/** The next day with no wet hours, for "wait for Sat". */
function nextDryDay(
  hourly: HourlyPoint[],
  timeZone: string,
): string | null {
  const byDay = new Map<string, HourlyPoint[]>();

  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  for (const hour of hourly) {
    const key = dayKey.format(hour.time);
    byDay.set(key, [...(byDay.get(key) ?? []), hour]);
  }

  const days = [...byDay.entries()].slice(1);

  for (const [, hours] of days) {
    if (hours.some(isWet)) continue;

    return new Intl.DateTimeFormat("en-CA", { timeZone, weekday: "short" }).format(
      hours[0].time,
    );
  }

  return null;
}

export function activityAnswers(
  current: CurrentConditions,
  hourly: HourlyPoint[],
  timeZone: string,
): ActivityAnswer[] {
  const bucket = conditionInfo(current.condition.code).bucket;
  const wetNow = hourly.length > 0 && isWet(hourly[0]);
  const wetSoon = hourly.slice(0, 6).some(isWet);
  const window_ = dryWindow(hourly, timeZone);
  const dryDay = nextDryDay(hourly, timeZone);

  const temp = current.temperature;
  const wind = current.wind.speed;
  const gust = current.wind.gust ?? wind;

  const answers: ActivityAnswer[] = [];

  const push = (
    id: string,
    label: string,
    result: { verdict: Verdict; answer: string; relevance: number },
  ) => answers.push({ id, label, ...result });

  push("run", "Good for a run", (() => {
    if (bucket === "thunderstorm") return { verdict: "bad" as const, answer: "No, storms about", relevance: 9 };
    if (wetNow) return { verdict: "bad" as const, answer: "Wet right now", relevance: 7 };
    if (temp >= 30 || current.uvIndex >= 8) return { verdict: "caution" as const, answer: "Early or late, not midday", relevance: 8 };
    if (temp <= -10) return { verdict: "caution" as const, answer: "Cold enough to cover up", relevance: 7 };
    if (gust >= 45) return { verdict: "caution" as const, answer: "Windy, sheltered route", relevance: 6 };
    return { verdict: "good" as const, answer: window_ ? `Yes, ${window_}` : "Yes, good conditions", relevance: window_ ? 8 : 5 };
  })());

  push("bike", "Window to bike", (() => {
    if (bucket === "thunderstorm" || bucket === "snow") return { verdict: "bad" as const, answer: "Not today", relevance: 8 };
    if (gust >= 40) return { verdict: "bad" as const, answer: "Too gusty", relevance: 8 };
    if (wetNow) return { verdict: "bad" as const, answer: "Wet roads now", relevance: 7 };
    if (temp <= 0) return { verdict: "caution" as const, answer: "Icy risk, take it slow", relevance: 7 };
    if (wetSoon && window_) return { verdict: "caution" as const, answer: `Go ${window_}`, relevance: 8 };
    return { verdict: "good" as const, answer: "Clear run of it", relevance: 4 };
  })());

  push("laundry", "Laundry outside", (() => {
    if (wetNow || wetSoon) {
      return { verdict: "bad" as const, answer: dryDay ? `No, wait for ${dryDay}` : "No, rain about", relevance: 7 };
    }
    if (current.humidity >= 85) return { verdict: "caution" as const, answer: "Too damp to dry well", relevance: 5 };
    if (wind >= 12 && temp >= 14 && current.humidity < 70) {
      return { verdict: "good" as const, answer: "Yes, drying nicely", relevance: 6 };
    }
    if (temp <= 5) return { verdict: "caution" as const, answer: "Slow going in this cold", relevance: 4 };
    return { verdict: "good" as const, answer: "Fine, if slow", relevance: 3 };
  })());

  push("car", "Wash the car", (() => {
    if (wetNow || wetSoon) {
      return { verdict: "bad" as const, answer: dryDay ? `Wait for ${dryDay}` : "Rain coming", relevance: 6 };
    }
    if (temp <= 0) return { verdict: "bad" as const, answer: "It will freeze on", relevance: 7 };
    // A dry spell of at least a day is what makes it worth doing.
    const dryStretch = hourly.slice(0, 24).every((hour) => !isWet(hour));
    return dryStretch
      ? { verdict: "good" as const, answer: "Yes, dry for a day", relevance: 5 }
      : { verdict: "caution" as const, answer: "Dry, but not for long", relevance: 4 };
  })());

  push("roads", "Road conditions", (() => {
    if (bucket === "snow") return { verdict: "bad" as const, answer: "Snow, allow extra time", relevance: 10 };
    if (bucket === "fog") return { verdict: "caution" as const, answer: "Low visibility", relevance: 9 };
    if (temp <= 1 && (wetNow || wetSoon)) return { verdict: "bad" as const, answer: "Ice likely", relevance: 10 };
    if (bucket === "thunderstorm") return { verdict: "caution" as const, answer: "Heavy rain, poor grip", relevance: 9 };
    if (wetNow) return { verdict: "caution" as const, answer: "Wet, brake earlier", relevance: 6 };
    return { verdict: "good" as const, answer: "Clear", relevance: 2 };
  })());

  // Most relevant first, so the hero shows what actually matters today rather
  // than a fixed list where "Road conditions: Clear" crowds out a storm warning.
  return answers.sort((a, b) => b.relevance - a.relevance);
}

/** The hero shows this many. Four fits without the panel needing to scroll. */
export function topAnswers(
  current: CurrentConditions,
  hourly: HourlyPoint[],
  timeZone: string,
  limit = 4,
): ActivityAnswer[] {
  return activityAnswers(current, hourly, timeZone).slice(0, limit);
}
