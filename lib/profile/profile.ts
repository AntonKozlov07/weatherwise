import type { VoiceDigest } from "@/lib/voice/prompt";

/**
 * What the reader likes and dislikes about weather.
 *
 * Used for one thing only: steering the paragraph on the home screen. It does
 * not move any threshold elsewhere in the app, does not change a displayed
 * number, and is never labelled on screen as personalisation (Decisions Log 117).
 *
 * Everything here is expressible as a list and a handful of enums, deliberately.
 * The deterministic engine has to consume the same profile as the model does, or
 * the paragraph would quietly lose its character whenever generation failed, and
 * the reader would have no way to tell why the app started talking differently.
 *
 * Stored on the device with the rest of the preferences. Nothing is uploaded, so
 * the privacy policy stays true as written.
 */

export type Tolerance = "like" | "neutral" | "dislike";

export type ActivityId =
  | "running"
  | "cycling"
  | "football"
  | "hiking"
  | "walking"
  | "swimming"
  | "golf"
  | "tennis"
  | "gardening"
  | "photography"
  | "skiing";

export type Avoidance =
  | "rain"
  | "strong-sun"
  | "grey"
  | "sudden-changes";

export type WeatherProfile = {
  activities: ActivityId[];
  heat: Tolerance;
  cold: Tolerance;
  wind: Tolerance;
  humidity: Tolerance;
  avoid: Avoidance[];
};

export const EMPTY_PROFILE: WeatherProfile = {
  activities: [],
  heat: "neutral",
  cold: "neutral",
  wind: "neutral",
  humidity: "neutral",
  avoid: [],
};

export const ACTIVITY_LABELS: Record<ActivityId, string> = {
  running: "Running",
  cycling: "Cycling",
  football: "Football",
  hiking: "Hiking",
  walking: "Walking the dog",
  swimming: "Swimming",
  golf: "Golf",
  tennis: "Tennis",
  gardening: "Gardening",
  photography: "Photography",
  skiing: "Skiing",
};

export const AVOIDANCE_LABELS: Record<Avoidance, string> = {
  rain: "Rain",
  "strong-sun": "Strong sun",
  grey: "Grey, overcast days",
  "sudden-changes": "Sudden changes",
};

/**
 * Whether the reader answered anything at all.
 *
 * A skipped profile has to be indistinguishable from never having been asked:
 * the paragraph falls back to the general one rather than to a personalised
 * paragraph with nothing in it.
 */
export function hasProfile(profile: WeatherProfile): boolean {
  return (
    profile.activities.length > 0 ||
    profile.avoid.length > 0 ||
    profile.heat !== "neutral" ||
    profile.cold !== "neutral" ||
    profile.wind !== "neutral" ||
    profile.humidity !== "neutral"
  );
}

/**
 * The thresholds a dislike has to cross before it is worth mentioning.
 *
 * Set where the condition starts to change what someone would do, not where it
 * becomes technically present. A profile that dislikes wind must not produce a
 * wind sentence on a still day, which is the failure this guards.
 */
const TRIGGERS = {
  heatC: 26,
  coldC: 5,
  gustKph: 30,
  humidityPercent: 75,
  /** Muggy needs warmth as well as moisture; damp and cold is a different thing. */
  muggyMinC: 18,
  uvIndex: 7,
  swingC: 8,
} as const;

export type Trigger =
  | "heat"
  | "cold"
  | "wind"
  | "humidity"
  | "rain"
  | "strong-sun"
  | "grey"
  | "sudden-changes";

/**
 * Which of the reader's dislikes today actually sets off.
 *
 * Likes are not triggers. Someone who loves heat does not need to be told it is
 * hot; the value of knowing it is in what gets recommended, not in an
 * observation they would make themselves.
 */
export function triggersFor(
  profile: WeatherProfile,
  digest: VoiceDigest,
): Trigger[] {
  const triggers: Trigger[] = [];
  const swing = Math.abs(digest.high - digest.low);

  if (profile.heat === "dislike" && digest.feelsLike >= TRIGGERS.heatC) {
    triggers.push("heat");
  }

  if (profile.cold === "dislike" && digest.feelsLike <= TRIGGERS.coldC) {
    triggers.push("cold");
  }

  if (profile.wind === "dislike" && digest.gustKph >= TRIGGERS.gustKph) {
    triggers.push("wind");
  }

  if (
    profile.humidity === "dislike" &&
    digest.humidity >= TRIGGERS.humidityPercent &&
    digest.temperature >= TRIGGERS.muggyMinC
  ) {
    triggers.push("humidity");
  }

  for (const avoid of profile.avoid) {
    if (avoid === "rain" && (digest.wetHours > 0 || digest.hoursToRain !== null)) {
      triggers.push("rain");
    }

    if (avoid === "strong-sun" && digest.uvIndex >= TRIGGERS.uvIndex) {
      triggers.push("strong-sun");
    }

    // Grey means overcast and dry. Overcast with rain is a rain day, and saying
    // both would be describing the same sky twice.
    if (
      avoid === "grey" &&
      digest.cloudCover >= 80 &&
      digest.wetHours === 0 &&
      digest.hoursToRain === null
    ) {
      triggers.push("grey");
    }

    if (avoid === "sudden-changes" && swing >= TRIGGERS.swingC) {
      triggers.push("sudden-changes");
    }
  }

  return triggers;
}

/** How each trigger is described to the model, in the reader's terms. */
const TRIGGER_PHRASES: Record<Trigger, string> = {
  heat: "the heat, which they would rather avoid",
  cold: "the cold, which they would rather avoid",
  wind: "the wind, which they do not like",
  humidity: "the humidity, which they do not like",
  rain: "the rain, which they would rather avoid",
  "strong-sun": "strong sun, which they would rather avoid",
  grey: "a grey overcast day, which they find dispiriting",
  "sudden-changes": "a big swing in temperature, which they dislike",
};

export function triggerPhrase(trigger: Trigger): string {
  return TRIGGER_PHRASES[trigger];
}

/**
 * Activities worth suggesting today, from the reader's own list.
 *
 * Filtered by condition rather than ranked: a swim in a thunderstorm and a
 * round of golf in a gale are not weak suggestions, they are wrong ones. What
 * survives is offered as-is, because ordering them would be inventing a
 * preference the reader never expressed.
 */
export function viableActivities(
  profile: WeatherProfile,
  digest: VoiceDigest,
): ActivityId[] {
  const wet = digest.wetHours > 0;
  const storm = digest.condition.toLowerCase().includes("thunder");
  const gusty = digest.gustKph >= 40;
  const freezing = digest.feelsLike <= 0;
  const hot = digest.feelsLike >= 28;

  return profile.activities.filter((activity) => {
    if (storm) return false;
    if (!digest.isDay && activity !== "running" && activity !== "walking") return false;

    switch (activity) {
      case "cycling":
        return !wet && !gusty && !freezing;
      case "golf":
      case "tennis":
      case "football":
        return !wet && !gusty;
      case "swimming":
        return !wet && !freezing;
      case "gardening":
        return !wet && !freezing;
      case "photography":
        return !storm;
      case "hiking":
        return !gusty && !hot;
      case "skiing":
        return freezing || digest.condition.toLowerCase().includes("snow");
      case "running":
      case "walking":
        return true;
    }
  });
}
