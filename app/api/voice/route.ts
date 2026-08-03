import { buildDigest, digestKey, SYSTEM_PROMPT, userPrompt } from "@/lib/voice/prompt";
import { adviceParagraph } from "@/lib/voice/advice";
import { validateAdvice, type Advice } from "@/lib/voice/validate";
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
/*
  Haiku, by request, and the right tool regardless: this is short, formulaic
  copy from a small structured input, which is what the model is quickest and
  cheapest at. One call returns all three fields, because asking three times
  would re-send the forecast three times and input tokens dominate the cost of
  a request this small (Decisions Log 90).
*/
const MODEL = "claude-haiku-4-5-20251001";

/**
 * Cached by digest, not by request.
 *
 * The key collapses a degree of drift and a few percent of humidity, so a
 * location generates one line per meaningful change rather than one per poll.
 * Module scope, which on serverless survives only as long as the instance; that
 * is still most repeat views, and the fallback covers the rest.
 */
const cache = new Map<string, { advice: Advice; at: number }>();
/* An hour. The digest key already collapses small drift, so a longer window
   mostly avoids regenerating the same copy after a cold start. */
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 200;

function cached(key: string): Advice | null {
  const hit = cache.get(key);
  if (!hit) return null;

  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }

  return hit.advice;
}

function remember(key: string, advice: Advice): void {
  // Oldest out first. A map iterates in insertion order, so this is enough
  // without a real LRU for a cache this small.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }

  cache.set(key, { advice, at: Date.now() });
}

type Body = {
  current?: CurrentConditions;
  hourly?: HourlyPoint[];
  timeZone?: string;
  latitude?: number;
  longitude?: number;
  /** Model agreement, computed with the forecast and passed through. */
  confidence?: "high" | "moderate" | "low" | null;
  /** Epoch millis, so the copy can say how long the light has left. */
  sunset?: number | null;
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
        // Three short fields plus JSON scaffolding. Capped tightly, because an
        // unbounded limit is an unbounded bill for copy that must stay short.
        max_tokens: 220,
        temperature: 1,
        system: SYSTEM_PROMPT,
        messages: [
          { role: "user", content: userPrompt(digest) },
          // Prefilled, so the reply starts inside the object and cannot open
          // with a preamble that would have to be stripped or rejected.
          { role: "assistant", content: "{" },
        ],
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      content?: { type: string; text?: string }[];
    };

    const text = payload.content?.find((block) => block.type === "text")?.text;
    if (text === undefined) return null;

    // The prefill is not echoed back, so it is restored before parsing.
    return `{${text}`;
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

  const digest = buildDigest(
    current,
    hourly,
    timeZone,
    body.confidence ?? null,
    typeof body.sunset === "number" ? body.sunset : null,
  );

  // The deterministic version is computed first, so there is always something
  // to return and the generated path never has to handle its own failure.
  const fallback: Advice = {
    paragraph: adviceParagraph(
      voiceLine({ current, hourly, timeZone }),
      digest,
      digest.confidence,
    ),
  };

  try {
    const key = [
      digestKey(digest, body.latitude ?? 0, body.longitude ?? 0),
      digest.confidence ?? "-",
      // Day and night produce different advice, so they cannot share a cache
      // entry: the evening would serve the afternoon's suggestion back.
      digest.period,
    ].join("|");

    const hit = cached(key);
    if (hit) return Response.json(hit);

    const raw = await generate(digest);
    if (raw === null) return Response.json(fallback);

    let parsed: unknown;

    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json(fallback);
    }

    const checked = validateAdvice(parsed, digest);

    if (!checked.ok) {
      // Logged without the copy itself: it is model output about a user's
      // location, and the reason is what makes the check improvable.
      console.warn(`Generated copy rejected: ${checked.reason}`);
      return Response.json(fallback);
    }

    remember(key, checked.advice);
    return Response.json(checked.advice);
  } catch (error) {
    console.error("Copy generation failed:", (error as Error).message);
    return Response.json(fallback);
  }
}
