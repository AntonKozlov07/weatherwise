import { ACTIVITY_LABELS, type ActivityId, type Trigger } from "@/lib/profile/profile";
import type { VoiceDigest } from "@/lib/voice/prompt";

/**
 * Deterministic clothing and activity advice.
 *
 * The floor beneath the generated version, for the same reasons as the voice
 * line: it runs offline, it costs nothing, and it cannot invent weather. Every
 * generated field has one of these behind it, so a failed call is invisible
 * rather than a gap on the screen (Decisions Log 89).
 *
 * Deliberately plain. This is the version nobody should notice.
 */

/** What to wear, from feels-like temperature, rain and wind. */
export function wearAdvice(digest: VoiceDigest): string {
  const feels = digest.feelsLike;
  const wet = digest.wetHours > 0 || digest.hoursToRain !== null;
  const windy = digest.gustKph >= 40;

  const base =
    feels <= -10
      ? "Everything you own, and cover your face"
      : feels <= 0
        ? "Proper coat, hat and gloves"
        : feels <= 7
          ? "Warm coat, and a layer under it"
          : feels <= 13
            ? "Jacket, or a jumper if you move about"
            : feels <= 19
              ? "Long sleeves, light jacket for later"
              : feels <= 26
                ? "T-shirt weather"
                : "As little as you can get away with";

  if (wet && windy) return `${base}. Waterproof, not an umbrella.`;
  if (wet) return `${base}. Take something waterproof.`;
  if (windy) return `${base}. Wind will cut through a light layer.`;
  if (digest.uvIndex >= 7) return `${base}. Hat and sunscreen if you are out long.`;

  return `${base}.`;
}

/** A sport or activity that suits the conditions. */
export function activityAdvice(digest: VoiceDigest): string {
  const raining = digest.hoursToDry !== null;
  const rainComing = digest.hoursToRain !== null && digest.hoursToRain <= 3;

  /*
    After dark nothing that needs daylight is worth suggesting. The generated
    version is told the same thing in its prompt; this is the floor beneath it,
    and it was recommending a run at midnight for the same reason
    (Decisions Log 112).
  */
  if (!digest.isDay) {
    if (digest.condition.toLowerCase().includes("thunder")) {
      return "Stay in tonight, and let the storm pass.";
    }
    if (raining) return "A wet night. Nothing outside worth getting soaked for.";
    if (digest.feelsLike <= 0) return "Cold night. A short walk at most, and wrap up.";
    if (digest.gustKph >= 45) return "Loud night out there. Better indoors.";
    if (rainComing) return "Dry for now, but rain overnight. Bring anything in.";

    return "A quiet night for a walk, if you want one.";
  }

  if (digest.condition.toLowerCase().includes("thunder")) {
    return "Indoors today. Nothing outside is worth a storm.";
  }

  if (raining) return "A gym or a pool day. Outside is a wash.";

  if (digest.gustKph >= 45) {
    return "Skip the bike. Running is fine if you pick a sheltered route.";
  }

  if (digest.feelsLike <= 0) {
    return "Skating or a brisk walk. Too cold to stand still for long.";
  }

  if (digest.temperature >= 28) {
    return "Swimming, or anything in shade. Save the run for the evening.";
  }

  if (rainComing) return "Good for a quick run now, before the rain arrives.";

  if (digest.feelsLike >= 14 && digest.feelsLike <= 24 && digest.wetHours === 0) {
    return "About perfect for a run, a ride or football.";
  }

  return "Fine for a walk or an easy run.";
}

/**
 * The deterministic paragraph.
 *
 * Composed from the three rules engines rather than written separately, so the
 * offline version is the same shape as the generated one: three sentences, same
 * order, same job. A fallback that renders as a stub would announce itself
 * (Decisions Log 104).
 */
export function adviceParagraph(
  line: string,
  digest: VoiceDigest,
  confidence: VoiceDigest["confidence"] = null,
  /** Null where the reader skipped the questions, which reads as no profile. */
  profileSentence: string | null = null,
): string {
  const sentences = [
    line,
    wearAdvice(digest),
    // The profile steers the closing sentence where it has something to say,
    // and stands aside where it does not.
    profileSentence ?? activityAdvice(digest),
  ];

  // The hedge the generated version gets through its prompt. Stated plainly
  // here, since a rules engine has no way to weave it in.
  if (confidence === "low") {
    sentences.push("Forecasts disagree about today, so treat it loosely.");
  }

  return sentences.join(" ");
}

/**
 * The deterministic third sentence, steered by the profile.
 *
 * The model gets the same profile through its prompt; this is the floor beneath
 * it. Without this the paragraph would quietly lose its character whenever
 * generation failed, and the reader would have no way to tell why the app had
 * started talking differently (Decisions Log 117).
 *
 * Deliberately plainer than the generated version. It nudges rather than
 * announces, for the same reason: naming the preference back at the reader is
 * telling them something they already know.
 */
export function profileAdvice(
  digest: VoiceDigest,
  triggers: Trigger[],
  activities: ActivityId[],
): string | null {
  const first = triggers[0];

  if (first) {
    const easing =
      digest.hoursToDry !== null
        ? ` It eases in about ${digest.hoursToDry} hours.`
        : "";

    switch (first) {
      case "heat":
        return `Hotter than you tend to enjoy. Shade and evening, if it can wait.`;
      case "cold":
        return `Colder than you like it. Worth keeping the trip short.`;
      case "wind":
        return `Blustery, which you would rather do without. Sheltered routes only.`;
      case "humidity":
        return `Heavy, muggy air, the kind you dislike. Later on will be easier.`;
      case "rain":
        return `Wet, which is not your weather.${easing || " Indoors is the easier call."}`;
      case "strong-sun":
        return `Sun is strong today, stronger than you like. Cover up or wait for the evening.`;
      case "grey":
        return `Flat and grey all day, the sort you find dispiriting. Nothing more to it than that.`;
      case "sudden-changes":
        return `A big swing between the high and the low today, which you do not much like.`;
    }
  }

  if (activities.length > 0) {
    const named = activities.slice(0, 2).map((id) => ACTIVITY_LABELS[id].toLowerCase());
    const list = named.length === 2 ? `${named[0]} or ${named[1]}` : named[0];

    return `Good conditions for ${list}, if you have the time.`;
  }

  // Nothing in the profile applies, so the general advice stands.
  return null;
}
