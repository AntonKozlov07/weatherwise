"use client";

import { useEffect, useState } from "react";

import { adviceParagraph, profileAdvice } from "@/lib/voice/advice";
import {
  EMPTY_PROFILE,
  hasProfile,
  triggersFor,
  viableActivities,
  type WeatherProfile,
} from "@/lib/profile/profile";
import { buildDigest } from "@/lib/voice/prompt";
import type { Advice } from "@/lib/voice/validate";
import { voiceLine } from "@/lib/voice/voice";
import type { CurrentConditions, HourlyPoint, LocationSummary } from "@/lib/weather/types";

/**
 * The home screen's written line.
 *
 * Returns the deterministic sentence immediately, then replaces it if the
 * server has a better one. Never a spinner and never an empty space: the line
 * is present on first paint and may quietly improve, which is the opposite of
 * the usual arrangement and the only one that survives being offline
 * (Decisions Log 84).
 *
 * A failed or slow request is not an error state. The line that is already on
 * screen is correct; it simply stays.
 */
export function useVoiceLine(
  current: CurrentConditions,
  hourly: HourlyPoint[],
  location: LocationSummary,
  confidence: "high" | "moderate" | "low" | null = null,
  sunset: number | null = null,
  profile: WeatherProfile = EMPTY_PROFILE,
): Advice {
  const digest = buildDigest(current, hourly, location.timeZone, confidence, sunset);

  const personalised = hasProfile(profile);

  const deterministic: Advice = {
    paragraph: adviceParagraph(
      voiceLine({ current, hourly, timeZone: location.timeZone }),
      digest,
      confidence,
      personalised
        ? profileAdvice(
            digest,
            triggersFor(profile, digest),
            viableActivities(profile, digest),
          )
        : null,
    ),
  };

  // The generated line is stored with the key it belongs to, rather than as a
  // bare string. Storing it bare meant switching city left the previous one on
  // screen until the new request came back, which is the one thing this line
  // must never do: it would be describing somewhere else entirely.
  const [generated, setGenerated] = useState<{ key: string; advice: Advice } | null>(
    null,
  );

  // Keyed on the observation, so a refresh that returns the same reading does
  // not trigger another round trip.
  // The profile is part of the key: changing an answer has to produce a new
  // paragraph rather than serving back one written for the old preferences.
  const key = [
    location.latitude,
    location.longitude,
    current.observedAt,
    confidence ?? "-",
    JSON.stringify(profile),
  ].join(",");

  useEffect(() => {
    let cancelled = false;

    fetch("/api/voice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        current,
        // Twelve hours is all the line considers, and the whole array would be
        // a large body for a sentence.
        hourly: hourly.slice(0, 12),
        timeZone: location.timeZone,
        latitude: location.latitude,
        longitude: location.longitude,
        confidence,
        sunset,
        profile,
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: Partial<Advice> | null) => {
        if (cancelled || !payload?.paragraph) return;

        setGenerated({ key, advice: { paragraph: payload.paragraph } });
      })
      .catch(() => {
        // Offline, or the route is unavailable. The deterministic line stands.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return generated?.key === key ? generated.advice : deterministic;
}
