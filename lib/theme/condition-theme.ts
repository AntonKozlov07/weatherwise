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
 * The theme is expressed in exactly two places: the hero's gradient bar, and the
 * accent. Backgrounds, cards and surfaces stay neutral graphite. An earlier
 * version also washed the page background with a condition tint; it made the
 * colour read as an accident of the palette rather than a deliberate signal, and
 * it fought the card separation. Confining it to one band is what makes it look
 * chosen (Decisions Log 64).
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
  /** The three stops of the hero's gradient bar, dark to light to mid. */
  gradient: [string, string, string];
  /** Used for the scrubber, active states and the timeline spine. */
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

type Palette = { gradient: [string, string, string]; accent: string };

/**
 * Gradient stops and accent per condition and time of day.
 *
 * The bar is the only saturated surface in the app, so these can carry real
 * colour without the screen becoming loud. Each ramp runs deep to bright to
 * mid, which gives the band a centre of gravity instead of a flat sweep.
 *
 * Accents are checked against the neutral background for WCAG AA large in
 * `condition-theme.test.ts`; none of these values is a guess.
 */
const PALETTE: Record<ConditionKey, Record<TimeOfDay, Palette>> = {
  clear: {
    dawn: { gradient: ["#3a2f4d", "#7a4f3a", "#6b5540"], accent: "#e0a878" },
    day: { gradient: ["#28455f", "#3b5d7a", "#4c5b67"], accent: "#8fb4d6" },
    dusk: { gradient: ["#452f4d", "#854837", "#73533b"], accent: "#d9906e" },
    night: { gradient: ["#151d30", "#35496f", "#4a5a76"], accent: "#8e9fc4" },
  },
  cloudy: {
    dawn: { gradient: ["#38323c", "#635751", "#615852"], accent: "#b7a79e" },
    day: { gradient: ["#333d47", "#515b65", "#545a60"], accent: "#9aa7b5" },
    dusk: { gradient: ["#3b333b", "#695558", "#665657"], accent: "#ad9c9e" },
    night: { gradient: ["#1a2028", "#414c5c", "#525b67"], accent: "#8a94a4" },
  },
  rain: {
    dawn: { gradient: ["#26303e", "#455c73", "#4d5a67"], accent: "#8ba6c2" },
    day: { gradient: ["#243849", "#3c5d77", "#4a5b68"], accent: "#7fa2c0" },
    dusk: { gradient: ["#2c2d3a", "#4c5a72", "#515a65"], accent: "#8598b4" },
    night: { gradient: ["#141d28", "#324a64", "#495c70"], accent: "#7d93ad" },
  },
  snow: {
    dawn: { gradient: ["#353a46", "#535a63", "#565a5f"], accent: "#bfc8d6" },
    day: { gradient: ["#38414c", "#515a63", "#565a5f"], accent: "#b8c6d6" },
    dusk: { gradient: ["#373842", "#545965", "#55595f"], accent: "#b2bccd" },
    night: { gradient: ["#1b212b", "#485462", "#535b64"], accent: "#9fadc2" },
  },
  storm: {
    dawn: { gradient: ["#2a2539", "#564a75", "#5d5570"], accent: "#a294c4" },
    day: { gradient: ["#2b263a", "#544b73", "#5c566e"], accent: "#9a90bd" },
    dusk: { gradient: ["#2e2437", "#58476e", "#60546d"], accent: "#9d8cb8" },
    night: { gradient: ["#171524", "#342d4e", "#5b5678"], accent: "#8d84ab" },
  },
  fog: {
    dawn: { gradient: ["#353537", "#5a5a5c", "#585857"], accent: "#aeaca8" },
    day: { gradient: ["#383a3b", "#585a5b", "#575959"], accent: "#a6aaad" },
    dusk: { gradient: ["#363334", "#5b585a", "#5b595a"], accent: "#a4a1a3" },
    night: { gradient: ["#1d1f21", "#474a4d", "#57595c"], accent: "#93979b" },
  },
};

export function conditionTheme(
  code: number,
  observedAt: number,
  sunrise: number | null,
  sunset: number | null,
): ConditionTheme {
  const timeOfDay = timeOfDayFor(observedAt, sunrise, sunset);
  const condition = conditionKeyFor(code);
  const { gradient, accent } = PALETTE[condition][timeOfDay];

  return { timeOfDay, condition, gradient, accent };
}

/**
 * The custom properties the root element carries. Deliberately short: --bg and
 * --surface are not among them, because the theme no longer touches the page.
 */
export function themeVariables(theme: ConditionTheme): Record<string, string> {
  return {
    "--grad-0": theme.gradient[0],
    "--grad-1": theme.gradient[1],
    "--grad-2": theme.gradient[2],
    "--accent": theme.accent,
  };
}
