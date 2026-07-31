import { conditionInfo } from "@/lib/weather/openweather/conditions";

/**
 * Condition and time-of-day theming.
 *
 * Produces CSS custom property values that are set once on the root element, so
 * the whole app inherits them. Not passed as props: a theme threaded through
 * components would have to be re-plumbed for every new screen, and could not
 * animate as one (Decisions Log 57).
 *
 * Time of day comes from the location's own sunrise, sunset and observation
 * time, never the device clock. Viewing a saved location in another timezone
 * has to show that location's sky.
 *
 * Backgrounds are deliberately restrained: two desaturated stops, low contrast
 * against the base graphite. This reads as expensive; a vivid skybox does not.
 * Every accent below is checked against its own background in
 * `condition-theme.test.ts` for WCAG AA.
 */

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";

export type ConditionKey =
  | "clear"
  | "cloudy"
  | "rain"
  | "snow"
  | "storm"
  | "fog";

export type ConditionTheme = {
  timeOfDay: TimeOfDay;
  condition: ConditionKey;
  /** Two-stop wash painted over the base background. */
  backgroundImage: string;
  /** Base colour beneath the wash. */
  background: string;
  accent: string;
};

/** Dawn and dusk are the 60 minutes either side of the sun crossing. */
const TWILIGHT_MS = 60 * 60 * 1000;

export function timeOfDayFor(
  observedAt: number,
  sunrise: number | null,
  sunset: number | null,
): TimeOfDay {
  // Without sun times there is no honest answer, and day is the safest default:
  // it is the highest-contrast theme.
  if (sunrise === null || sunset === null) return "day";

  if (Math.abs(observedAt - sunrise) <= TWILIGHT_MS) return "dawn";
  if (Math.abs(observedAt - sunset) <= TWILIGHT_MS) return "dusk";

  return observedAt > sunrise && observedAt < sunset ? "day" : "night";
}

/**
 * Six visual buckets, mapped from the seven gradient buckets the condition
 * table already produces. `partlyCloudy` and `overcast` both read as cloudy at
 * background scale; splitting them would be a difference nobody could see.
 */
export function conditionKeyFor(code: number): ConditionKey {
  switch (conditionInfo(code).bucket) {
    case "clear":
      return "clear";
    case "partlyCloudy":
    case "overcast":
      return "cloudy";
    case "rain":
      return "rain";
    case "snow":
      return "snow";
    case "thunderstorm":
      return "storm";
    case "fog":
      return "fog";
  }
}

/** Base page colour per time of day. Night is the darkest, dawn the warmest. */
const BASE: Record<TimeOfDay, string> = {
  dawn: "#1b1a1f",
  day: "#16191d",
  dusk: "#1a181c",
  night: "#111418",
};

/**
 * The wash tint per condition and time of day, and the accent that goes with
 * it. Tints are low-alpha over the base, so the result stays in the graphite
 * family rather than becoming a coloured screen.
 */
const TINT: Record<ConditionKey, Record<TimeOfDay, { tint: string; accent: string }>> = {
  clear: {
    dawn: { tint: "255 176 122", accent: "#e0a878" },
    day: { tint: "150 190 225", accent: "#8fb4d6" },
    dusk: { tint: "236 138 108", accent: "#d9906e" },
    night: { tint: "120 148 200", accent: "#8e9fc4" },
  },
  cloudy: {
    dawn: { tint: "196 176 168", accent: "#b7a79e" },
    day: { tint: "168 182 196", accent: "#9aa7b5" },
    dusk: { tint: "186 166 168", accent: "#ad9c9e" },
    night: { tint: "132 144 160", accent: "#8a94a4" },
  },
  rain: {
    dawn: { tint: "128 158 190", accent: "#8ba6c2" },
    day: { tint: "116 152 186", accent: "#7fa2c0" },
    dusk: { tint: "120 142 174", accent: "#8598b4" },
    night: { tint: "96 124 158", accent: "#7d93ad" },
  },
  snow: {
    dawn: { tint: "206 216 230", accent: "#bfc8d6" },
    day: { tint: "200 216 232", accent: "#b8c6d6" },
    dusk: { tint: "194 202 220", accent: "#b2bccd" },
    night: { tint: "166 182 204", accent: "#9fadc2" },
  },
  storm: {
    dawn: { tint: "150 138 186", accent: "#a294c4" },
    day: { tint: "140 132 178", accent: "#9a90bd" },
    dusk: { tint: "146 128 172", accent: "#9d8cb8" },
    night: { tint: "118 110 154", accent: "#8d84ab" },
  },
  fog: {
    dawn: { tint: "186 184 180", accent: "#aeaca8" },
    day: { tint: "178 182 184", accent: "#a6aaad" },
    dusk: { tint: "176 172 174", accent: "#a4a1a3" },
    night: { tint: "142 146 150", accent: "#93979b" },
  },
};

/** Night reads deeper, so its wash is weaker; day carries the most light. */
const WASH_ALPHA: Record<TimeOfDay, [number, number]> = {
  dawn: [0.13, 0.05],
  day: [0.12, 0.05],
  dusk: [0.14, 0.055],
  night: [0.09, 0.035],
};

export function conditionTheme(
  code: number,
  observedAt: number,
  sunrise: number | null,
  sunset: number | null,
): ConditionTheme {
  const timeOfDay = timeOfDayFor(observedAt, sunrise, sunset);
  const condition = conditionKeyFor(code);
  const { tint, accent } = TINT[condition][timeOfDay];
  const [top, side] = WASH_ALPHA[timeOfDay];

  return {
    timeOfDay,
    condition,
    background: BASE[timeOfDay],
    // Two stops, both very wide and very soft. Painted on a fixed layer so it
    // does not repeat or scroll.
    backgroundImage: [
      `radial-gradient(130% 68% at 50% -12%, rgb(${tint} / ${top}), transparent 62%)`,
      `radial-gradient(96% 56% at 104% 2%, rgb(${tint} / ${side}), transparent 58%)`,
    ].join(", "),
    accent,
  };
}

/** The custom properties the root element carries. */
export function themeVariables(theme: ConditionTheme): Record<string, string> {
  return {
    "--bg": theme.background,
    "--condition-wash": theme.backgroundImage,
    "--accent": theme.accent,
  };
}
