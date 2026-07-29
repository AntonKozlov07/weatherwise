"use client";

import { useEffect, useState } from "react";

import { GRADIENT_TICK_MS, getGreetingGradient } from "@/lib/gradient";
import type { Astronomy, ConditionRef } from "@/lib/weather/types";

type Props = {
  /** Empty until onboarding captures it (Decisions Log 5). */
  name?: string;
  condition: ConditionRef;
  astronomy: Astronomy;
  timeZone: string;
};

function salutation(now: Date, timeZone: string): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );

  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

/**
 * Falls back to rough clock hours only when the real sun times are missing,
 * which happens when Open-Meteo failed. The gradient is meant to track the
 * actual sky, so this is a degraded mode, not an alternative.
 */
function sunTimes(astronomy: Astronomy, now: Date): { sunrise: Date; sunset: Date } {
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

export function Greeting({ name, condition, astronomy, timeZone }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Recomputed every 60 seconds, per CLAUDE.md. A drift this slow does not
    // need requestAnimationFrame, and an interval keeps it off the main thread
    // between ticks.
    const timer = setInterval(() => setNow(new Date()), GRADIENT_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const { sunrise, sunset } = sunTimes(astronomy, now);
  const gradient = getGreetingGradient(now, sunrise, sunset, condition.code);

  // Trimmed, or a name stored with trailing whitespace renders "Anton !".
  const trimmed = name?.trim();
  const text = `${salutation(now, timeZone)}${trimmed ? ` ${trimmed}` : ""}!`;

  return (
    <h1
      className="type-heading text-[1.75rem] leading-tight"
      style={{
        backgroundImage: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
      }}
    >
      {text}
    </h1>
  );
}
