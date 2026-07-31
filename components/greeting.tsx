"use client";

import { useEffect, useState } from "react";

import { GRADIENT_TICK_MS, type GradientStops } from "@/lib/gradient";
import { gradientMotion } from "@/lib/gradient-motion";
import type { Tilt } from "@/lib/hooks/use-tilt";

type Props = {
  /** Empty until onboarding captures it (Decisions Log 5). */
  name?: string;
  gradient: GradientStops;
  timeZone: string;
  /** The same tilt the hero card uses, so the two lean together. */
  tilt: Tilt;
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

export function Greeting({ name, gradient, timeZone, tilt }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), GRADIENT_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Trimmed, or a name stored with trailing whitespace renders "Anton !".
  const trimmed = name?.trim();
  const text = `${salutation(now, timeZone)}${trimmed ? ` ${trimmed}` : ""}!`;

  const motion = gradientMotion(tilt);

  return (
    <h1
      // Scales with the viewport between an SE and a Pro Max rather than
      // sitting at one size and wrapping badly at the extremes.
      className={`type-heading text-[clamp(1.6rem,8vw,2.25rem)] leading-[1.15] ${motion.className}`}
      data-tilt={motion.dataTilt}
      style={{
        // Three stops rather than two, and oversized, so the highlight has
        // somewhere to travel as the phone turns. Two stops at 100% cannot move.
        backgroundImage: `linear-gradient(100deg, ${gradient.from}, ${gradient.to} 45%, ${gradient.from})`,
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        color: "transparent",
        ...motion.style,
      }}
    >
      {text}
    </h1>
  );
}
