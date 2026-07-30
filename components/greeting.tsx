"use client";

import { useEffect, useState } from "react";

import { GRADIENT_TICK_MS, type GradientStops } from "@/lib/gradient";

type Props = {
  /** Empty until onboarding captures it (Decisions Log 5). */
  name?: string;
  gradient: GradientStops;
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

export function Greeting({ name, gradient, timeZone }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), GRADIENT_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  // Trimmed, or a name stored with trailing whitespace renders "Anton !".
  const trimmed = name?.trim();
  const text = `${salutation(now, timeZone)}${trimmed ? ` ${trimmed}` : ""}!`;

  return (
    <h1
      // Scales with the viewport between an SE and a Pro Max rather than
      // sitting at one size and wrapping badly at the extremes.
      className="type-heading text-[clamp(1.6rem,8vw,2.25rem)] leading-[1.15]"
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
