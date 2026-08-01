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
