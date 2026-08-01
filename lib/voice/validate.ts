import type { VoiceDigest } from "@/lib/voice/prompt";

/**
 * Checks generated copy before it is allowed on the screen.
 *
 * A rules engine cannot state a temperature the forecast does not contain. A
 * model can, and the failure is invisible: "rain around 4pm" reads exactly as
 * well when there is no rain coming. This is the check that makes generated
 * copy safe to show, and anything failing it falls back to the deterministic
 * version rather than being shown with a caveat (Decisions Log 85).
 *
 * The rule is that every number must be one the model was given. Not similar to
 * one, not within a degree: present in the digest. That is stricter than
 * necessary and deliberately so, because the alternative is reasoning about
 * which wrong numbers are acceptable.
 */

const MAX_LENGTH = 160;

/** Words that mean the model narrated instead of writing the copy. */
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

export type Advice = { line: string; wear: string; activity: string };

export type Validation =
  | { ok: true; advice: Advice }
  | { ok: false; reason: string };

/**
 * Every number the copy is allowed to use.
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
    // The swing, which copy may state as "up 6 degrees".
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

/** One field. Returns the cleaned string, or the reason it was rejected. */
function checkField(raw: string, allowed: Set<number>): string | { reason: string } {
  // Models like to wrap copy in quotes even when told not to. The meridiem is
  // upper cased here as well: the prompt cannot be relied on for typography,
  // and a generated "3pm" beside a rendered "3PM" is the inconsistency this
  // whole pass exists to remove.
  const text = raw
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/(\d)\s*([ap])\.?\s*m\.?/gi, (_m, digit: string, meridiem: string) =>
      `${digit}${meridiem.toUpperCase()}M`,
    )
    .trim();

  if (text.length === 0) return { reason: "empty" };
  if (text.length > MAX_LENGTH) return { reason: "too long" };
  if (text.includes("\n")) return { reason: "multiple lines" };

  const lower = text.toLowerCase();

  for (const phrase of BANNED) {
    if (lower.includes(phrase)) return { reason: `banned phrase: ${phrase}` };
  }

  for (const match of text.matchAll(/\d+(?:\.\d+)?/g)) {
    const value = Number(match[0]);
    if (!allowed.has(value)) return { reason: `unsupported number: ${value}` };
  }

  return text;
}

/**
 * Checks a whole response. All three fields, or none of them.
 *
 * A response where the clothing advice is sound but the line invents a
 * temperature is not a partial success. It means the model was willing to make
 * something up, and the other fields have no better claim to being right than
 * the one that was caught.
 */
export function validateAdvice(raw: unknown, digest: VoiceDigest): Validation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "not an object" };
  }

  const candidate = raw as Partial<Advice>;
  const allowed = allowedNumbers(digest);
  const checked: Partial<Advice> = {};

  for (const field of ["line", "wear", "activity"] as const) {
    const value = candidate[field];

    if (typeof value !== "string") return { ok: false, reason: `${field} missing` };

    const result = checkField(value, allowed);

    if (typeof result !== "string") {
      return { ok: false, reason: `${field}: ${result.reason}` };
    }

    checked[field] = result;
  }

  return { ok: true, advice: checked as Advice };
}
