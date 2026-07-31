"use client";

import { useEffect, useState } from "react";

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
): string {
  const deterministic = voiceLine({ current, hourly, timeZone: location.timeZone });

  // The generated line is stored with the key it belongs to, rather than as a
  // bare string. Storing it bare meant switching city left the previous one on
  // screen until the new request came back, which is the one thing this line
  // must never do: it would be describing somewhere else entirely.
  const [generated, setGenerated] = useState<{ key: string; line: string } | null>(
    null,
  );

  // Keyed on the observation, so a refresh that returns the same reading does
  // not trigger another round trip.
  const key = `${location.latitude},${location.longitude},${current.observedAt}`;

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
      }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { line?: string } | null) => {
        if (cancelled || !payload?.line) return;
        setGenerated({ key, line: payload.line });
      })
      .catch(() => {
        // Offline, or the route is unavailable. The deterministic line stands.
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return generated?.key === key ? generated.line : deterministic;
}
