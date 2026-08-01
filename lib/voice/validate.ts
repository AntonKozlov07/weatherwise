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

/** Three sentences. Long enough for the paragraph, short enough to stay a card. */
const MAX_LENGTH = 340;

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

/**
 * One paragraph of three sentences: what today is like, what to wear, what it
 * means for being outside. Replaced three separate fields, which rendered as a
 * form rather than as somebody telling you about the day (Decisions Log 104).
 */
export type Advice = { paragraph: string };

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
 * Checks the response.
 *
 * A paragraph where the clothing advice is sound but the first sentence invents
 * a temperature is not a partial success: it means the model was willing to make
 * something up, and the rest has no better claim to being right than the part
 * that was caught. So it passes whole or not at all.
 */
export function validateAdvice(raw: unknown, digest: VoiceDigest): Validation {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, reason: "not an object" };
  }

  const candidate = raw as Partial<Advice>;

  if (typeof candidate.paragraph !== "string") {
    return { ok: false, reason: "paragraph missing" };
  }

  const result = checkField(candidate.paragraph, allowedNumbers(digest));

  if (typeof result !== "string") return { ok: false, reason: result.reason };

  return { ok: true, advice: { paragraph: result } };
}

/** The first sentence, for the collapsed card. */
export function firstSentence(paragraph: string): string {
  const match = paragraph.match(/^[^.!?]+[.!?]/);
  return (match ? match[0] : paragraph).trim();
}
