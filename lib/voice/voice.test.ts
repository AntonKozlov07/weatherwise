import { describe, expect, it } from "vitest";

import { VOICE_RULE_IDS, voiceLine } from "./voice";
import { topAnswers } from "@/lib/activities/activities";
import type { CurrentConditions, HourlyPoint } from "@/lib/weather/types";

const TZ = "America/Toronto";
const HOUR = 3_600_000;
/** 2026-07-28T14:00:00Z, which is 10am in Toronto. */
const NOW = Date.UTC(2026, 6, 28, 14, 0);

const wind = (speed: number, gust = speed) => ({
  speed,
  gust,
  direction: 270,
  compass: "W",
});

function current(overrides: Partial<CurrentConditions> = {}): CurrentConditions {
  return {
    observedAt: NOW,
    condition: { code: 800, label: "Clear", isDay: true },
    temperature: 18,
    feelsLike: 18,
    dewPoint: 10,
    humidity: 55,
    pressure: 1013,
    visibility: 10,
    cloudCover: 10,
    precipitation: 0,
    uvIndex: 4,
    wind: wind(10),
    ...overrides,
  };
}

/** Hours from a list of [temperature, mm/h] pairs. */
function hours(spec: [number, number][]): HourlyPoint[] {
  return spec.map(([temperature, precipitation], index) => ({
    time: NOW + index * HOUR,
    condition: { code: 800, label: "Clear", isDay: true },
    temperature,
    feelsLike: temperature,
    precipitationChance: precipitation > 0 ? 80 : 5,
    precipitation,
    humidity: 55,
    uvIndex: 3,
    wind: wind(10),
  }));
}

const steady = (temp = 18, wet = 0): [number, number][] =>
  new Array(12).fill([temp, wet]) as [number, number][];

describe("voiceLine", () => {
  it("always returns a sentence, even with no hourly data", () => {
    const line = voiceLine({ current: current(), hourly: [], timeZone: TZ });

    expect(line).toMatch(/\w/);
    expect(line.endsWith(".")).toBe(true);
  });

  // Severity outranks everything: a storm matters more than a temperature swing.
  it("leads with the storm when one is overhead", () => {
    const line = voiceLine({
      current: current({ condition: { code: 200, label: "Thunderstorm", isDay: true } }),
      hourly: hours(steady(25)),
      timeZone: TZ,
    });

    expect(line).toContain("Thunderstorm");
  });

  it("names when rain arrives rather than just that it will", () => {
    const line = voiceLine({
      current: current(),
      hourly: hours([...new Array(4).fill([18, 0]), ...new Array(8).fill([16, 1])] as [number, number][]),
      timeZone: TZ,
    });

    expect(line).toMatch(/rain/i);
    // 10am local plus four hours reads as an afternoon clock time.
    expect(line).toMatch(/2pm|hours/i);
  });

  it("tells you rain is ending when it is already wet", () => {
    const line = voiceLine({
      current: current({ precipitation: 1 }),
      hourly: hours([...new Array(2).fill([16, 1]), ...new Array(10).fill([18, 0])] as [number, number][]),
      timeZone: TZ,
    });

    expect(line).toMatch(/easing|drying/i);
  });

  it("calls out a warming morning", () => {
    const line = voiceLine({
      current: current({ temperature: 8 }),
      hourly: hours([8, 10, 12, 14, 16, 17, 18, 18, 18, 18, 18, 18].map((t) => [t, 0]) as [number, number][]),
      timeZone: TZ,
    });

    expect(line).toMatch(/warm|jacket|climb/i);
  });

  it("warns about a frost that has not arrived yet", () => {
    const line = voiceLine({
      current: current({ temperature: 6 }),
      hourly: hours([6, 5, 4, 3, 2, 1, 0, -1, -2, -2, -2, -2].map((t) => [t, 0]) as [number, number][]),
      timeZone: TZ,
    });

    expect(line).toMatch(/freez|frost/i);
  });

  it("separates hot and humid from merely hot", () => {
    const humid = voiceLine({
      current: current({ temperature: 30, humidity: 80 }),
      hourly: hours(steady(30)),
      timeZone: TZ,
    });
    const dry = voiceLine({
      current: current({ temperature: 30, humidity: 30 }),
      hourly: hours(steady(30)),
      timeZone: TZ,
    });

    expect(humid).not.toBe(dry);
    expect(humid).toMatch(/heavy|feel/i);
  });

  it("mentions gusts by number when they are strong", () => {
    const line = voiceLine({
      current: current({ wind: wind(40, 70) }),
      hourly: hours(steady(18)),
      timeZone: TZ,
    });

    expect(line).toContain("70");
  });

  // Determinism is the whole reason this is a rules engine and not a model.
  it("is deterministic for identical input", () => {
    const input = { current: current(), hourly: hours(steady()), timeZone: TZ };

    expect(voiceLine(input)).toBe(voiceLine(input));
  });

  it("has unique rule ids and enough branches to cover the space", () => {
    expect(new Set(VOICE_RULE_IDS).size).toBe(VOICE_RULE_IDS.length);
    expect(VOICE_RULE_IDS.length).toBeGreaterThanOrEqual(30);
  });

  /**
   * A rain-bucket code with a dry twelve hours matches no branch: the
   * precipitation rules need actual precipitation, and the pleasant-weather
   * rules are scoped to the clear, cloudy and overcast buckets.
   */
  it("falls back to a neutral sentence when nothing matches", () => {
    const line = voiceLine({
      current: current({
        temperature: 19,
        humidity: 50,
        wind: wind(8),
        condition: { code: 501, label: "Rain", isDay: true },
      }),
      hourly: hours(steady(19)),
      timeZone: TZ,
    });

    expect(line).toMatch(/steady|Nothing much/i);
  });
});

describe("topAnswers", () => {
  it("returns at most four, most relevant first", () => {
    const answers = topAnswers(current(), hours(steady()), TZ);

    expect(answers.length).toBeLessThanOrEqual(4);
    expect(answers[0].relevance).toBeGreaterThanOrEqual(
      answers[answers.length - 1].relevance,
    );
  });

  // Relevance, not verdict quality: icy roads must outrank a pleasant run.
  it("surfaces hazards ahead of pleasant verdicts", () => {
    const answers = topAnswers(
      current({ temperature: 0, condition: { code: 601, label: "Snow", isDay: true } }),
      hours(steady(0, 1)),
      TZ,
    );

    expect(answers[0].id).toBe("roads");
    expect(answers[0].verdict).toBe("bad");
  });

  it("gives a window rather than a bare yes when rain is coming", () => {
    const answers = topAnswers(
      current(),
      hours([...new Array(5).fill([18, 0]), ...new Array(7).fill([16, 1])] as [number, number][]),
      TZ,
    );

    const run = answers.find((answer) => answer.id === "run");
    expect(run?.answer).toMatch(/until/i);
  });

  it("only ever emits the three known verdicts", () => {
    const answers = topAnswers(current(), hours(steady()), TZ, 5);

    for (const answer of answers) {
      expect(["good", "caution", "bad"]).toContain(answer.verdict);
    }
  });
});
