import { buildDigest, digestKey, SYSTEM_PROMPT, userPrompt } from "@/lib/voice/prompt";
import { validateLine } from "@/lib/voice/validate";
import { voiceLine } from "@/lib/voice/voice";
import type { CurrentConditions, HourlyPoint } from "@/lib/weather/types";

/**
 * The written line for the home screen.
 *
 * Generated where possible, deterministic where not. The rules engine is not a
 * degraded mode: it is the floor. It runs offline, it cannot invent weather,
 * and it is what ships whenever generation fails, times out, or returns
 * something that does not survive validation (Decisions Log 84).
 *
 * The response never says which produced it. That is a product decision, and it
 * also means a failed generation is invisible rather than a visible downgrade.
 *
 * The key stays server side, like every other vendor credential in this app.
 */

export const maxDuration = 15;

/** A model call is not worth more than this for one sentence. */
const TIMEOUT_MS = 6_000;
const MODEL = "claude-sonnet-5";

/**
 * Cached by digest, not by request.
 *
 * The key collapses a degree of drift and a few percent of humidity, so a
 * location generates one line per meaningful change rather than one per poll.
 * Module scope, which on serverless survives only as long as the instance; that
 * is still most repeat views, and the fallback covers the rest.
 */
const cache = new Map<string, { line: string; at: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 200;

function cached(key: string): string | null {
  const hit = cache.get(key);
  if (!hit) return null;

  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return hit.line;
}

function remember(key: string, line: string): void {
  // Oldest out first. A map iterates in insertion order, so this is enough
  // without a real LRU for a cache this small.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  cache.set(key, { line, at: Date.now() });
}

type Body = {
  current?: CurrentConditions;
  hourly?: HourlyPoint[];
  timeZone?: string;
  latitude?: number;
  longitude?: number;
};

async function generate(digest: ReturnType<typeof buildDigest>): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt(digest) }],
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };

    return payload.content?.find((block) => block.type === "text")?.text ?? null;
  } catch {
    // Timeout, network, or a malformed response. All the same outcome here.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function POST(request: Request): Promise<Response> {
  let body: Body;

  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: { message: "Malformed body." } }, { status: 400 });
  }

  const { current, hourly, timeZone } = body;

  if (!current || !Array.isArray(hourly) || typeof timeZone !== "string") {
    return Response.json({ error: { message: "Missing forecast." } }, { status: 400 });
  }

  // The deterministic line is computed first, so there is always something to
  // return and the generated path never has to handle its own failure.
  const fallback = voiceLine({ current, hourly, timeZone });

  try {
    const digest = buildDigest(current, hourly, timeZone);
    const key = digestKey(digest, body.latitude ?? 0, body.longitude ?? 0);

    const hit = cached(key);
    if (hit) return Response.json({ line: hit });

    const raw = await generate(digest);
    if (raw === null) return Response.json({ line: fallback });

    const checked = validateLine(raw, digest);

    if (!checked.ok) {
      // Logged without the line itself: it is model output about a user's
      // location, and the reason is what makes the check improvable.
      console.warn(`Voice line rejected: ${checked.reason}`);
      return Response.json({ line: fallback });
    }

    remember(key, checked.line);
    return Response.json({ line: checked.line });
  } catch (error) {
    console.error("Voice generation failed:", (error as Error).message);
    return Response.json({ line: fallback });
  }
}
