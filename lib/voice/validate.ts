import type { VoiceDigest } from "@/lib/voice/prompt";

/**
 * Checks a generated line before it is allowed on the screen.
 *
 * A rules engine cannot state a temperature the forecast does not contain. A
 * model can, and the failure is invisible: "rain around 4pm" reads exactly as
 * well when there is no rain coming. This is the check that makes generated
 * copy safe to show, and anything that fails it falls back to the deterministic
 * sentence rather than being shown with a caveat (Decisions Log 84).
 *
 * The rule is that every number in the line must be one the model was given.
 * Not similar to one, not within a degree: present in the digest. That is
 * stricter than necessary and deliberately so, because the alternative is
 * reasoning about which wrong numbers are acceptable.
 */

const MAX_LENGTH = 160;

/** Words that mean the model narrated instead of writing the line. */
const BANNED = [
  "as an ai",
  "language model",
  "i cannot",
  "i can't",
  "based on the data",
  "the data shows",
  "here is",
  "here's a",
  "forecast:",
];

export type Validation =
  | { ok: true; line: string }
  | { ok: false; reason: string };

/**
 * Every number the line is allowed to use.
 *
 * Clock hours are derived rather than listed: the digest holds offsets like
 * "rain in 4 hours", and a line may legitimately turn that into "around 4pm",
 * so the hours those offsets land on are permitted too.
 */
function allowedNumbers(digest: VoiceDigest): Set<number> {
  const allowed = new Set<number>([
    digest.temperature,
    digest.feelsLike,
    digest.humidity,
    digest.windKph,
    digest.gustKph,
    digest.uvIndex,
    digest.high,
    digest.low,
    digest.wetHours,
    digest.heaviestMmH,
    digest.hour,
    // The swing, which a line may state as "up 6 degrees".
    digest.high - digest.low,
    Math.abs(digest.high - digest.temperature),
    Math.abs(digest.temperature - digest.low),
  ]);

  for (const offset of [digest.hoursToRain, digest.hoursToDry]) {
    if (offset === null) continue;

    allowed.add(offset);

    const at = (digest.hour + offset) % 24;
    allowed.add(at);
    // Twelve-hour clock, which is how the app writes times everywhere else.
    allowed.add(at > 12 ? at - 12 : at === 0 ? 12 : at);
  }

  return allowed;
}

export function validateLine(raw: string, digest: VoiceDigest): Validation {
  // Models like to wrap a line in quotes even when told not to.
  const line = raw.trim().replace(/^["'“”]+|["'“”]+$/g, "").trim();

  if (line.length === 0) return { ok: false, reason: "empty" };
  if (line.length > MAX_LENGTH) return { ok: false, reason: "too long" };

  const lower = line.toLowerCase();

  for (const phrase of BANNED) {
    if (lower.includes(phrase)) return { ok: false, reason: `banned phrase: ${phrase}` };
  }

  if (line.includes("\n")) return { ok: false, reason: "multiple lines" };

  const allowed = allowedNumbers(digest);

  for (const match of line.matchAll(/\d+(?:\.\d+)?/g)) {
    const value = Number(match[0]);
    if (!allowed.has(value)) {
      return { ok: false, reason: `unsupported number: ${value}` };
    }
  }

  return { ok: true, line };
}
