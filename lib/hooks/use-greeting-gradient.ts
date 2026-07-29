"use client";

import { useEffect, useState } from "react";

import { GRADIENT_TICK_MS, getGreetingGradient, type GradientStops } from "@/lib/gradient";
import type { Astronomy, ConditionRef } from "@/lib/weather/types";

/**
 * Falls back to rough clock hours only when the real sun times are missing,
 * which happens when Open-Meteo failed. The gradient is meant to track the
 * actual sky, so this is a degraded mode, not an alternative.
 */
function sunTimes(
  astronomy: Astronomy,
  now: Date,
): { sunrise: Date; sunset: Date } {
  if (astronomy.sunrise !== null && astronomy.sunset !== null) {
    return {
      sunrise: new Date(astronomy.sunrise),
      sunset: new Date(astronomy.sunset),
    };
  }

  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);

  return {
    sunrise: new Date(midnight.getTime() + 6 * 3_600_000),
    sunset: new Date(midnight.getTime() + 20 * 3_600_000),
  };
}

/**
 * The greeting gradient, recomputed every 60 seconds.
 *
 * Shared rather than kept inside the greeting, because the card edges are
 * tinted from the same stops. Computing it in two places would let them drift
 * apart by a tick.
 */
export function useGreetingGradient(
  condition: ConditionRef,
  astronomy: Astronomy,
): GradientStops {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), GRADIENT_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const { sunrise, sunset } = sunTimes(astronomy, now);

  return getGreetingGradient(now, sunrise, sunset, condition.code);
}
