/**
 * Time-of-day windows for the greeting gradient, anchored to real sunrise and
 * sunset rather than clock hours, so the colours drift through the year.
 */

export type GradientWindow =
  | "dawn"
  | "morning"
  | "midday"
  | "goldenHour"
  | "dusk"
  | "night";

export type GradientStops = { from: string; to: string };

export const BASE_STOPS: Record<GradientWindow, GradientStops> = {
  dawn: { from: "#2B3A67", to: "#FF9E7A" },
  morning: { from: "#FFB347", to: "#FFF3D6" },
  midday: { from: "#FFD84D", to: "#FFFFFF" },
  goldenHour: { from: "#FFFFFF", to: "#FF7B54" },
  dusk: { from: "#FF7B54", to: "#6B4A8F" },
  night: { from: "#9AA3AE", to: "#4A5158" },
};

/** Each window blends into this one as its elapsed fraction runs 0 to 1. */
const NEXT_WINDOW: Record<GradientWindow, GradientWindow> = {
  dawn: "morning",
  morning: "midday",
  midday: "goldenHour",
  goldenHour: "dusk",
  dusk: "night",
  night: "dawn",
};

const MINUTE = 60_000;
const DAY = 86_400_000;

export type WindowPosition = {
  window: GradientWindow;
  next: GradientWindow;
  /** 0 at the start of the window, 1 at its end. */
  fraction: number;
};

type Segment = { window: GradientWindow; start: number; end: number };

/**
 * Boundaries are forced to be non-decreasing.
 *
 * At extreme latitudes the offsets can cross: a two hour winter day puts
 * `sunset - 150min` before `sunrise + 45min`. Clamping collapses the squeezed
 * window to zero length rather than producing a negative span, which would make
 * the fraction blow up. Saved locations make this reachable, so it is handled
 * rather than assumed away.
 */
function buildSegments(sunrise: number, sunset: number): Segment[] {
  const dawnStart = sunrise - 90 * MINUTE;

  const boundaries: number[] = [];
  let previous = dawnStart;

  for (const candidate of [
    sunrise + 45 * MINUTE,
    // Midpoint between sunrise and solar noon, solar noon being the midpoint of
    // sunrise and sunset.
    sunrise + (sunset - sunrise) / 4,
    sunset - 150 * MINUTE,
    sunset + 15 * MINUTE,
    sunset + 90 * MINUTE,
  ]) {
    previous = Math.max(previous, candidate);
    boundaries.push(previous);
  }

  const [dawnEnd, morningEnd, middayEnd, goldenEnd, duskEnd] = boundaries;

  return [
    { window: "dawn", start: dawnStart, end: dawnEnd },
    { window: "morning", start: dawnEnd, end: morningEnd },
    { window: "midday", start: morningEnd, end: middayEnd },
    { window: "goldenHour", start: middayEnd, end: goldenEnd },
    { window: "dusk", start: goldenEnd, end: duskEnd },
    // Night runs from dusk to the next day's dawn. Using a flat 24 hours drifts
    // by a couple of minutes against tomorrow's real sunrise, which is far below
    // the resolution of a colour blend.
    { window: "night", start: duskEnd, end: dawnStart + DAY },
  ];
}

export function resolveWindow(
  now: number,
  sunrise: number,
  sunset: number,
): WindowPosition {
  const segments = buildSegments(sunrise, sunset);
  const dawnStart = segments[0].start;
  const duskEnd = segments[5].start;

  // Before dawn is still last night, which began before the sunrise we were
  // handed. Shift that segment back a day rather than treating it as a gap.
  if (now < dawnStart) {
    const start = duskEnd - DAY;
    return {
      window: "night",
      next: "dawn",
      fraction: progress(now, start, dawnStart),
    };
  }

  for (const segment of segments) {
    if (segment.end <= segment.start) continue;
    if (now < segment.end) {
      return {
        window: segment.window,
        next: NEXT_WINDOW[segment.window],
        fraction: progress(now, segment.start, segment.end),
      };
    }
  }

  // Past the end of night, which means the anchors are more than a day stale.
  return { window: "night", next: "dawn", fraction: 1 };
}

function progress(now: number, start: number, end: number): number {
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}
