import { describe, expect, it } from "vitest";

import {
  EMPTY_PROFILE,
  hasProfile,
  triggersFor,
  viableActivities,
  type WeatherProfile,
} from "./profile";
import { parseProfile } from "./parse";
import type { VoiceDigest } from "@/lib/voice/prompt";

function digest(overrides: Partial<VoiceDigest> = {}): VoiceDigest {
  return {
    temperature: 20,
    feelsLike: 20,
    condition: "Clear",
    humidity: 50,
    windKph: 10,
    gustKph: 12,
    uvIndex: 3,
    hour: 12,
    high: 22,
    low: 18,
    hoursToRain: null,
    hoursToDry: null,
    wetHours: 0,
    heaviestMmH: 0,
    isDay: true,
    period: "afternoon",
    hoursToDark: 5,
    cloudCover: 10,
    confidence: null,
    ...overrides,
  };
}

const profile = (overrides: Partial<WeatherProfile> = {}): WeatherProfile => ({
  ...EMPTY_PROFILE,
  ...overrides,
});

describe("hasProfile", () => {
  /**
   * A skipped profile has to be indistinguishable from never having been asked,
   * or the paragraph falls back to a personalised one with nothing in it.
   */
  it("is false for an untouched profile", () => {
    expect(hasProfile(EMPTY_PROFILE)).toBe(false);
  });

  it("is true once anything at all is answered", () => {
    expect(hasProfile(profile({ activities: ["running"] }))).toBe(true);
    expect(hasProfile(profile({ heat: "dislike" }))).toBe(true);
    expect(hasProfile(profile({ avoid: ["rain"] }))).toBe(true);
  });
});

describe("triggersFor", () => {
  /**
   * The failure this exists to prevent: a profile that dislikes wind producing
   * a wind sentence on a still day.
   */
  it("says nothing about a dislike the day does not set off", () => {
    const disliked = profile({ wind: "dislike", heat: "dislike", humidity: "dislike" });

    expect(triggersFor(disliked, digest())).toEqual([]);
  });

  it("fires each dislike at its own threshold", () => {
    expect(triggersFor(profile({ heat: "dislike" }), digest({ feelsLike: 27 }))).toEqual(["heat"]);
    expect(triggersFor(profile({ cold: "dislike" }), digest({ feelsLike: 3 }))).toEqual(["cold"]);
    expect(triggersFor(profile({ wind: "dislike" }), digest({ gustKph: 35 }))).toEqual(["wind"]);
  });

  // Damp and cold is a different thing from muggy, so humidity needs warmth too.
  it("only calls it muggy when it is also warm", () => {
    const humid = profile({ humidity: "dislike" });

    expect(triggersFor(humid, digest({ humidity: 85, temperature: 24 }))).toEqual(["humidity"]);
    expect(triggersFor(humid, digest({ humidity: 85, temperature: 8 }))).toEqual([]);
  });

  /**
   * Liking something is not a trigger. Someone who loves heat does not need to
   * be told it is hot; they can feel that.
   */
  it("never fires on a preference the reader enjoys", () => {
    expect(triggersFor(profile({ heat: "like" }), digest({ feelsLike: 32 }))).toEqual([]);
  });

  describe("grey days", () => {
    it("fires on overcast and dry", () => {
      const grey = profile({ avoid: ["grey"] });
      expect(triggersFor(grey, digest({ cloudCover: 95 }))).toEqual(["grey"]);
    });

    // Overcast with rain is a rain day. Saying both describes one sky twice.
    it("stands aside when it is also raining", () => {
      const grey = profile({ avoid: ["grey", "rain"] });
      const wet = digest({ cloudCover: 95, wetHours: 4 });

      expect(triggersFor(grey, wet)).toEqual(["rain"]);
    });
  });
});

describe("viableActivities", () => {
  const outdoorsy = profile({
    activities: ["cycling", "running", "swimming", "gardening"],
  });

  it("keeps everything on a good day", () => {
    expect(viableActivities(outdoorsy, digest())).toEqual([
      "cycling",
      "running",
      "swimming",
      "gardening",
    ]);
  });

  // A ride in a downpour is not a weak suggestion, it is a wrong one.
  it("drops what the weather rules out", () => {
    const wet = viableActivities(outdoorsy, digest({ wetHours: 5 }));

    expect(wet).toEqual(["running"]);
  });

  it("clears the list entirely in a thunderstorm", () => {
    expect(viableActivities(outdoorsy, digest({ condition: "Thunderstorm" }))).toEqual([]);
  });

  it("keeps only what can be done after dark", () => {
    const night = viableActivities(outdoorsy, digest({ isDay: false }));

    expect(night).toEqual(["running"]);
  });

  it("suggests nothing when the reader chose nothing", () => {
    expect(viableActivities(EMPTY_PROFILE, digest())).toEqual([]);
  });
});

describe("parseProfile", () => {
  it("drops unknown activities and tolerances", () => {
    const parsed = parseProfile({
      activities: ["running", "juggling", 7],
      avoid: ["rain", "asteroids"],
      heat: "loathe",
      cold: "dislike",
    });

    expect(parsed.activities).toEqual(["running"]);
    expect(parsed.avoid).toEqual(["rain"]);
    expect(parsed.heat).toBe("neutral");
    expect(parsed.cold).toBe("dislike");
  });

  it("deduplicates, so nothing is suggested twice", () => {
    expect(parseProfile({ activities: ["running", "running"] }).activities).toEqual([
      "running",
    ]);
  });

  it("returns an empty profile for anything that is not one", () => {
    expect(parseProfile(null)).toEqual(EMPTY_PROFILE);
    expect(parseProfile("nope")).toEqual(EMPTY_PROFILE);
  });
});
