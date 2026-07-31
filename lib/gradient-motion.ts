import type { CSSProperties } from "react";

import type { Tilt } from "@/lib/hooks/use-tilt";

/**
 * How a gradient responds to the phone moving.
 *
 * Shared by the hero card and the greeting so the two lean together. Two of the
 * same effect written twice drift apart, and a card that follows your hand
 * beside a headline that does not is worse than neither moving.
 *
 * Two modes, and only ever one at a time:
 *
 *   live    Motion effects are on. The gradient's position is driven straight
 *           from the tilt, and the looping animation is switched off, because a
 *           keyframe animation on `background-position` and an inline value for
 *           the same property fight, and the animation always wins.
 *
 *   drift   Motion effects are off, or the device has no orientation to give.
 *           A slow loop runs instead, since a gradient that never moves reads
 *           as a screenshot (Decisions Log 73).
 */

/**
 * How far the gradient slides, as a percentage either side of centre. The
 * background is sized well over 100%, so this stays inside the artwork and
 * never exposes an edge.
 */
const TRAVEL = 26;

export function gradientMotion(tilt: Tilt): {
  className: string;
  dataTilt: "live" | undefined;
  style: CSSProperties;
} {
  if (!tilt.live) {
    return { className: "ww-gradient-drift", dataTilt: undefined, style: {} };
  }

  return {
    className: "",
    dataTilt: "live",
    style: {
      backgroundPosition: `${50 + tilt.x * TRAVEL}% ${50 + tilt.y * TRAVEL}%`,
    },
  };
}
