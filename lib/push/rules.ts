import type { CurrentConditions, HourlyPoint } from "@/lib/weather/types";

/**
 * Custom threshold rules.
 *
 * "Tell me when it drops below zero", "tell me when rain is coming". Severe
 * weather alerts are issued by an authority and are the same for everyone;
 * these are personal, and the two are kept apart deliberately: a rule about
 * laundry weather must never look like a government warning (Decisions Log 69).
 *
 * The engine is pure, and evaluates to a boolean per rule. Whether that boolean
 * becomes a notification is decided by the transition check below, not here.
 */

export type RuleKind =
  | "temp-below"
  | "temp-above"
  | "wind-above"
  | "uv-above"
  | "rain-starting"
  | "frost-tonight";

export type ThresholdRule = {
  id: string;
  kind: RuleKind;
  /** Celsius, km/h or UV index depending on kind. Ignored where not needed. */
  value: number;
  enabled: boolean;
};

/** What a rule looks at, so a rule can be evaluated without a whole bundle. */
export type RuleInput = {
  current: CurrentConditions;
  hourly: HourlyPoint[];
};

/** Rain at or above this counts. Below it is a rounding artefact, not weather. */
const WET_MM_H = 0.2;
const LIKELY_CHANCE = 55;
/** How far ahead the forward-looking rules look. */
const LOOKAHEAD_HOURS = 6;
const FROST_LOOKAHEAD_HOURS = 12;

export const RULE_LABELS: Record<RuleKind, string> = {
  "temp-below": "Temperature drops below",
  "temp-above": "Temperature rises above",
  "wind-above": "Wind gusts above",
  "uv-above": "UV index above",
  "rain-starting": "Rain is about to start",
  "frost-tonight": "Frost expected tonight",
};

/** Rules that compare against a number the user picks. */
export const RULE_UNITS: Partial<Record<RuleKind, string>> = {
  "temp-below": "°C",
  "temp-above": "°C",
  "wind-above": "km/h",
  "uv-above": "",
};

export function ruleDescription(rule: ThresholdRule): string {
  const unit = RULE_UNITS[rule.kind];

  return unit === undefined
    ? RULE_LABELS[rule.kind]
    : `${RULE_LABELS[rule.kind]} ${rule.value}${unit}`;
}

function wet(hour: HourlyPoint): boolean {
  return hour.precipitation >= WET_MM_H || hour.precipitationChance >= LIKELY_CHANCE;
}

/** Whether the rule's condition holds right now. */
export function evaluateRule(rule: ThresholdRule, input: RuleInput): boolean {
  const { current, hourly } = input;
  const ahead = hourly.slice(0, LOOKAHEAD_HOURS);

  switch (rule.kind) {
    case "temp-below":
      return current.temperature < rule.value;

    case "temp-above":
      return current.temperature > rule.value;

    case "wind-above":
      return (current.wind.gust ?? current.wind.speed) > rule.value;

    case "uv-above":
      return current.uvIndex > rule.value;

    // Forward-looking, and deliberately not "it is raining": by the time it is
    // raining the notification is too late to be worth sending.
    case "rain-starting":
      return hourly.length > 0 && !wet(hourly[0]) && ahead.some(wet);

    case "frost-tonight":
      return hourly
        .slice(0, FROST_LOOKAHEAD_HOURS)
        .some((hour) => hour.temperature <= 0);
  }
}

/** The message a fired rule sends. Short: it lands on a lock screen. */
export function ruleMessage(
  rule: ThresholdRule,
  input: RuleInput,
): { title: string; body: string } {
  const temperature = Math.round(input.current.temperature);
  const gust = Math.round(input.current.wind.gust ?? input.current.wind.speed);

  switch (rule.kind) {
    case "temp-below":
      return { title: `Down to ${temperature}°`, body: `Below your ${rule.value}° mark.` };
    case "temp-above":
      return { title: `Up to ${temperature}°`, body: `Above your ${rule.value}° mark.` };
    case "wind-above":
      return { title: `Gusting ${gust} km/h`, body: "Anything loose outside will move." };
    case "uv-above":
      return {
        title: `UV index ${Math.round(input.current.uvIndex)}`,
        body: "Cover up if you are out for long.",
      };
    case "rain-starting":
      return { title: "Rain on the way", body: "Starting within the next few hours." };
    case "frost-tonight":
      return { title: "Frost tonight", body: "Bring in anything that minds a freeze." };
  }
}

/**
 * Which rules should fire.
 *
 * Only rules that were false last time and are true now. Without this, a rule
 * for "below zero" would notify on every poll for as long as it stayed cold,
 * which is the single fastest way to get notifications turned off (Decisions
 * Log 69).
 *
 * Returns the next state alongside, so the caller writes back exactly what was
 * evaluated rather than recomputing it.
 */
export function firingRules(
  rules: ThresholdRule[],
  previous: Record<string, boolean>,
  input: RuleInput,
): { firing: ThresholdRule[]; nextState: Record<string, boolean> } {
  const firing: ThresholdRule[] = [];
  const nextState: Record<string, boolean> = {};

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const holds = evaluateRule(rule, input);
    nextState[rule.id] = holds;

    if (holds && previous[rule.id] !== true) firing.push(rule);
  }

  return { firing, nextState };
}

/** Guards what arrives from the client before it reaches the database. */
export function parseRules(value: unknown): ThresholdRule[] {
  if (!Array.isArray(value)) return [];

  const kinds: RuleKind[] = [
    "temp-below",
    "temp-above",
    "wind-above",
    "uv-above",
    "rain-starting",
    "frost-tonight",
  ];

  return value
    .filter((entry): entry is ThresholdRule => {
      if (typeof entry !== "object" || entry === null) return false;

      const rule = entry as Partial<ThresholdRule>;

      return (
        typeof rule.id === "string" &&
        rule.id.length > 0 &&
        rule.id.length <= 64 &&
        typeof rule.kind === "string" &&
        kinds.includes(rule.kind as RuleKind) &&
        typeof rule.value === "number" &&
        Number.isFinite(rule.value) &&
        typeof rule.enabled === "boolean"
      );
    })
    // Capped: a device that posts ten thousand rules would otherwise turn one
    // poll into ten thousand evaluations and as many notifications.
    .slice(0, 12);
}
