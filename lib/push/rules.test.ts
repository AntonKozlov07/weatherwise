import { describe, expect, it } from "vitest";

import { evaluateRule, firingRules, parseRules, ruleDescription } from "./rules";
import type { ThresholdRule } from "./rules";
import type { CurrentConditions, HourlyPoint } from "@/lib/weather/types";

const HOUR = 3_600_000;
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
    temperature: 12,
    feelsLike: 12,
    dewPoint: 6,
    humidity: 55,
    pressure: 1013,
    visibility: 10,
    cloudCover: 10,
    precipitation: 0,
    uvIndex: 3,
    wind: wind(10),
    ...overrides,
  };
}

/** Hours from [temperature, mm/h] pairs. */
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

const dry = (temp = 12): [number, number][] =>
  new Array(12).fill([temp, 0]) as [number, number][];

const rule = (over: Partial<ThresholdRule> = {}): ThresholdRule => ({
  id: "r1",
  kind: "temp-below",
  value: 0,
  enabled: true,
  ...over,
});

describe("evaluateRule", () => {
  it("compares temperature in both directions", () => {
    const input = { current: current({ temperature: -3 }), hourly: hours(dry(-3)) };

    expect(evaluateRule(rule({ kind: "temp-below", value: 0 }), input)).toBe(true);
    expect(evaluateRule(rule({ kind: "temp-above", value: 0 }), input)).toBe(false);
  });

  // Gusts, not sustained speed: gusts are what actually knock things over.
  it("uses gusts for the wind rule", () => {
    const input = { current: current({ wind: wind(20, 62) }), hourly: hours(dry()) };

    expect(evaluateRule(rule({ kind: "wind-above", value: 50 }), input)).toBe(true);
  });

  it("falls back to sustained speed where no gust is reported", () => {
    const input = {
      current: current({ wind: { ...wind(70), gust: null } }),
      hourly: hours(dry()),
    };

    expect(evaluateRule(rule({ kind: "wind-above", value: 50 }), input)).toBe(true);
  });

  describe("rain-starting", () => {
    // The point is to warn before it rains. Firing once it already is would be
    // a notification that arrives after the information is useful.
    it("fires before the rain, not during it", () => {
      const coming = {
        current: current(),
        hourly: hours([[12, 0], [12, 0], [11, 1.5], ...dry(11).slice(3)]),
      };
      const already = {
        current: current(),
        hourly: hours([[11, 1.5], [11, 1.5], ...dry(11).slice(2)]),
      };

      expect(evaluateRule(rule({ kind: "rain-starting" }), coming)).toBe(true);
      expect(evaluateRule(rule({ kind: "rain-starting" }), already)).toBe(false);
    });

    it("ignores rain beyond the lookahead", () => {
      const input = {
        current: current(),
        hourly: hours([...dry(12).slice(0, 9), [11, 2], [11, 2], [11, 2]]),
      };

      expect(evaluateRule(rule({ kind: "rain-starting" }), input)).toBe(false);
    });
  });

  it("looks half a day ahead for frost", () => {
    const input = {
      current: current({ temperature: 8 }),
      hourly: hours([8, 7, 5, 4, 3, 2, 1, 0, -1, -1, -2, -2].map((t) => [t, 0]) as [
        number,
        number,
      ][]),
    };

    expect(evaluateRule(rule({ kind: "frost-tonight" }), input)).toBe(true);
  });

  it("returns false rather than throwing with no hourly data", () => {
    const input = { current: current(), hourly: [] };

    expect(evaluateRule(rule({ kind: "rain-starting" }), input)).toBe(false);
    expect(evaluateRule(rule({ kind: "frost-tonight" }), input)).toBe(false);
  });
});

describe("firingRules", () => {
  const cold = { current: current({ temperature: -5 }), hourly: hours(dry(-5)) };
  const rules = [rule({ id: "freeze", kind: "temp-below", value: 0 })];

  it("fires on the transition into the condition", () => {
    const { firing, nextState } = firingRules(rules, {}, cold);

    expect(firing.map((r) => r.id)).toEqual(["freeze"]);
    expect(nextState).toEqual({ freeze: true });
  });

  /**
   * The whole reason the state is stored. A rule that re-notified every poll
   * for as long as it stayed cold is the fastest way to get push turned off.
   */
  it("stays silent while the condition simply continues", () => {
    const { firing } = firingRules(rules, { freeze: true }, cold);

    expect(firing).toEqual([]);
  });

  it("fires again after the condition clears and returns", () => {
    const warm = { current: current({ temperature: 6 }), hourly: hours(dry(6)) };

    const cleared = firingRules(rules, { freeze: true }, warm);
    expect(cleared.firing).toEqual([]);
    expect(cleared.nextState.freeze).toBe(false);

    const returned = firingRules(rules, cleared.nextState, cold);
    expect(returned.firing.map((r) => r.id)).toEqual(["freeze"]);
  });

  it("skips disabled rules entirely, and does not track their state", () => {
    const off = [rule({ id: "freeze", value: 0, enabled: false })];
    const { firing, nextState } = firingRules(off, {}, cold);

    expect(firing).toEqual([]);
    expect(nextState).toEqual({});
  });
});

describe("parseRules", () => {
  it("keeps well-formed rules and drops the rest", () => {
    const parsed = parseRules([
      { id: "a", kind: "temp-below", value: 0, enabled: true },
      { id: "b", kind: "not-a-kind", value: 0, enabled: true },
      { id: "c", kind: "temp-above", value: "hot", enabled: true },
      { id: "", kind: "uv-above", value: 7, enabled: true },
      null,
      "nope",
    ]);

    expect(parsed.map((r) => r.id)).toEqual(["a"]);
  });

  it("rejects anything that is not an array", () => {
    expect(parseRules(undefined)).toEqual([]);
    expect(parseRules({ id: "a" })).toEqual([]);
  });

  // A device posting thousands of rules would turn one poll into thousands of
  // evaluations and as many notifications.
  it("caps how many a single device can register", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({
      id: `r${i}`,
      kind: "temp-below" as const,
      value: 0,
      enabled: true,
    }));

    expect(parseRules(many)).toHaveLength(12);
  });
});

describe("ruleDescription", () => {
  it("includes the threshold only where there is one", () => {
    expect(ruleDescription(rule({ kind: "temp-below", value: -5 }))).toBe(
      "Temperature drops below -5°C",
    );
    expect(ruleDescription(rule({ kind: "frost-tonight" }))).toBe(
      "Frost expected tonight",
    );
  });
});
