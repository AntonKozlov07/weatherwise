import { describe, expect, it } from "vitest";

import {
  conditionKeyFor,
  conditionTheme,
  themeVariables,
  timeOfDayFor,
  type ConditionKey,
  type TimeOfDay,
} from "./condition-theme";
import { AA_LARGE, AA_TEXT, contrastRatio, parseHex } from "./contrast";

/** Must match tokens.css. */
const TEXT = "#edeae4";
const TEXT_DIM = "#a6a49f";
const BG = "#16191d";
const SURFACE = "#1d2126";

const HOUR = 3_600_000;
const SUNRISE = Date.UTC(2026, 6, 28, 10, 0);
const SUNSET = Date.UTC(2026, 6, 28, 24, 0);

/** A representative OWM code per visual bucket. */
const CODES: Record<ConditionKey, number> = {
  clear: 800,
  cloudy: 804,
  rain: 501,
  snow: 601,
  storm: 200,
  fog: 741,
};

const TIMES: Record<TimeOfDay, number> = {
  dawn: SUNRISE,
  day: SUNRISE + 4 * HOUR,
  dusk: SUNSET,
  night: SUNSET + 4 * HOUR,
};

describe("timeOfDayFor", () => {
  it("calls the hour either side of the sun crossing twilight", () => {
    expect(timeOfDayFor(SUNRISE, SUNRISE, SUNSET)).toBe("dawn");
    expect(timeOfDayFor(SUNRISE - 59 * 60_000, SUNRISE, SUNSET)).toBe("dawn");
    expect(timeOfDayFor(SUNSET, SUNRISE, SUNSET)).toBe("dusk");
  });

  it("separates day from night outside twilight", () => {
    expect(timeOfDayFor(SUNRISE + 4 * HOUR, SUNRISE, SUNSET)).toBe("day");
    expect(timeOfDayFor(SUNSET + 4 * HOUR, SUNRISE, SUNSET)).toBe("night");
    expect(timeOfDayFor(SUNRISE - 4 * HOUR, SUNRISE, SUNSET)).toBe("night");
  });

  // The theme has to follow the saved location, not the device. These are all
  // absolute instants, so a location in another timezone themes by its own sky.
  it("works from absolute instants, not a local clock", () => {
    const tokyoSunrise = Date.UTC(2026, 6, 28, 19, 30);
    const tokyoSunset = Date.UTC(2026, 6, 29, 9, 45);

    expect(timeOfDayFor(Date.UTC(2026, 6, 29, 2, 0), tokyoSunrise, tokyoSunset)).toBe("day");
  });

  // Without sun times there is no honest answer; day is the highest-contrast
  // default rather than a guess that could render dark text on dark.
  it("falls back to day when sun times are missing", () => {
    expect(timeOfDayFor(Date.now(), null, null)).toBe("day");
    expect(timeOfDayFor(Date.now(), SUNRISE, null)).toBe("day");
  });
});

describe("conditionKeyFor", () => {
  it("maps OWM codes to the six visual buckets", () => {
    expect(conditionKeyFor(800)).toBe("clear");
    expect(conditionKeyFor(501)).toBe("rain");
    expect(conditionKeyFor(601)).toBe("snow");
    expect(conditionKeyFor(200)).toBe("storm");
    expect(conditionKeyFor(741)).toBe("fog");
  });

  // Partly cloudy and overcast are indistinguishable at background scale.
  it("collapses partly cloudy and overcast into one bucket", () => {
    expect(conditionKeyFor(802)).toBe("cloudy");
    expect(conditionKeyFor(804)).toBe("cloudy");
  });

  it("falls back to clear for an unknown code", () => {
    expect(conditionKeyFor(9999)).toBe("clear");
  });
});

describe("generated themes", () => {
  const combinations = (Object.keys(CODES) as ConditionKey[]).flatMap((condition) =>
    (Object.keys(TIMES) as TimeOfDay[]).map((time) => ({ condition, time })),
  );

  it("covers every condition and time of day", () => {
    expect(combinations).toHaveLength(24);
  });

  /**
   * The theme no longer touches the page background, so text always sits on the
   * neutral tokens. Both are checked: --bg for the page, --surface for cards,
   * which is the lighter of the two and therefore the worse case for light text.
   */
  it.each([BG, SURFACE])("keeps body and dimmed text at AA on %s", (background) => {
    expect(contrastRatio(TEXT, background)).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrastRatio(TEXT_DIM, background)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  // Accents drive the scrubber, the spine and active states, so the 3:1 UI
  // threshold applies rather than the 4.5:1 body-text one. Checked against the
  // lighter surface, since an accent on a raised card is the worst case.
  it.each(combinations)(
    "keeps the accent at AA large on $condition/$time",
    ({ condition, time }) => {
      const theme = conditionTheme(CODES[condition], TIMES[time], SUNRISE, SUNSET);

      expect(contrastRatio(theme.accent, SURFACE)).toBeGreaterThanOrEqual(AA_LARGE);
    },
  );

  it.each(combinations)(
    "gives the bar three usable stops on $condition/$time",
    ({ condition, time }) => {
      const theme = conditionTheme(CODES[condition], TIMES[time], SUNRISE, SUNSET);

      expect(theme.gradient).toHaveLength(3);
      for (const stop of theme.gradient) expect(stop).toMatch(/^#[0-9a-f]{6}$/i);

      // Dark to light, so the band has a direction rather than reading flat.
      const lightness = theme.gradient.map((stop) => {
        const { r, g, b } = parseHex(stop);
        return r + g + b;
      });

      expect(lightness[1]).toBeGreaterThan(lightness[0]);
      expect(lightness[2]).toBeGreaterThan(lightness[1]);
    },
  );

  // White text sits on the bar's brightest stop in the hero, so that one stop
  // has to stay dark enough to carry it.
  it.each(combinations)(
    "keeps the brightest stop below the text on $condition/$time",
    ({ condition, time }) => {
      const theme = conditionTheme(CODES[condition], TIMES[time], SUNRISE, SUNSET);
      const brightest = parseHex(theme.gradient[2]);
      const text = parseHex(TEXT);

      expect(brightest.r + brightest.g + brightest.b).toBeLessThan(
        text.r + text.g + text.b,
      );
    },
  );
});

describe("themeVariables", () => {
  it("exposes exactly the custom properties the root sets", () => {
    const theme = conditionTheme(800, TIMES.day, SUNRISE, SUNSET);
    const variables = themeVariables(theme);

    // --bg is absent on purpose: the theme is confined to the bar and the accent.
    expect(Object.keys(variables).sort()).toEqual([
      "--accent",
      "--grad-0",
      "--grad-1",
      "--grad-2",
    ]);
    expect(variables["--accent"]).toMatch(/^#[0-9a-f]{6}$/i);
  });
});
