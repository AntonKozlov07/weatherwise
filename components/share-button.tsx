"use client";

import { useState } from "react";

import { formatTemperature, type Units } from "@/lib/format";
import type { CurrentConditions } from "@/lib/weather/types";

/**
 * Share the current conditions.
 *
 * Text, not an image. A rendered card would mean drawing the hero to a canvas,
 * which cannot reuse any of the CSS that makes it look the way it does, so it
 * would be a second implementation of the same design that quietly drifts from
 * the first. A sentence survives being pasted anywhere (Decisions Log 80).
 *
 * The Web Share API where it exists, which on iOS is the real system sheet, and
 * a clipboard copy everywhere else. Hidden entirely where neither is available,
 * rather than offering a button that does nothing.
 */

type Props = {
  current: CurrentConditions;
  locationName: string;
  units: Units;
  line: string;
  index: number;
};

function canShare(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.share === "function";
}

function canCopy(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.writeText === "function"
  );
}

export function ShareButton({ current, locationName, units, line, index }: Props) {
  const [copied, setCopied] = useState(false);

  const text = [
    `${locationName}: ${formatTemperature(current.temperature, units)}°${
      units === "metric" ? "C" : "F"
    }, ${current.condition.label.toLowerCase()}.`,
    line,
  ].join(" ");

  const share = async () => {
    try {
      if (canShare()) {
        await navigator.share({ title: "WeatherWise", text });
        return;
      }

      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Dismissing the share sheet rejects, and that is not a failure. Nothing
      // is reported either way: the user knows what they just did.
    }
  };

  // Neither route available, so no button. An affordance that cannot act is
  // worse than its absence.
  if (!canShare() && !canCopy()) return null;

  return (
    <button
      type="button"
      onClick={share}
      className="ww-stagger ww-press mt-4 flex w-full items-center justify-center gap-2 rounded-inner bg-surface py-3 text-xs text-text-dim"
      style={{ "--i": index } as React.CSSProperties}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 16V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {copied ? "Copied" : "Share"}
    </button>
  );
}
