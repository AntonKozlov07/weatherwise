import { conditionBucket, type ConditionBucket } from "./conditions";
import {
  desaturate,
  hexToOklch,
  mixOklch,
  oklchToHex,
  type Oklch,
} from "./oklch";
import { BASE_STOPS, resolveWindow, type GradientStops } from "./windows";

export type { GradientStops, GradientWindow } from "./windows";
export type { ConditionBucket } from "./conditions";

type OklchStops = { from: Oklch; to: Oklch };

type Modifier = {
  /** Fraction of chroma removed. */
  desaturate?: number;
  /** Colour and strength to blend both stops toward. */
  blend?: { colour: string; amount: number };
  /** Pulls both stops' lightness toward their mean, flattening the gradient. */
  compressLightness?: number;
};

const MODIFIERS: Record<ConditionBucket, Modifier> = {
  clear: {},
  partlyCloudy: { desaturate: 0.15 },
  overcast: { desaturate: 0.35, blend: { colour: "#8A919C", amount: 0.2 } },
  rain: { blend: { colour: "#5B7A99", amount: 0.3 } },
  snow: { blend: { colour: "#D9E8F5", amount: 0.3 } },
  thunderstorm: { blend: { colour: "#6B5BA8", amount: 0.25 } },
  // Fog flattens the gradient as well as draining it: real fog removes the
  // contrast between one part of the sky and another.
  fog: { desaturate: 0.5, compressLightness: 0.7 },
};

function stopsToOklch(stops: GradientStops): OklchStops {
  return { from: hexToOklch(stops.from), to: hexToOklch(stops.to) };
}

function applyModifier(stops: OklchStops, modifier: Modifier): OklchStops {
  let { from, to } = stops;

  if (modifier.desaturate !== undefined) {
    from = desaturate(from, modifier.desaturate);
    to = desaturate(to, modifier.desaturate);
  }

  if (modifier.blend) {
    const target = hexToOklch(modifier.blend.colour);
    from = mixOklch(from, target, modifier.blend.amount);
    to = mixOklch(to, target, modifier.blend.amount);
  }

  if (modifier.compressLightness !== undefined) {
    const mean = (from.l + to.l) / 2;
    const strength = modifier.compressLightness;
    from = { ...from, l: from.l + (mean - from.l) * strength };
    to = { ...to, l: to.l + (mean - to.l) * strength };
  }

  return { from, to };
}

/**
 * The greeting's left-to-right gradient for a moment in time and a condition.
 *
 * Pure, and free of React by design (see CLAUDE.md), so the palette can be
 * tuned against `/dev/gradient` and unit tested without rendering anything.
 *
 * Interpolation is continuous: within a window the stops blend toward the next
 * window's stops as the window elapses, so nothing snaps at a boundary.
 *
 * `sunrise` and `sunset` must be real instants for the active location. Callers
 * without them should not guess with clock hours; the whole point is that the
 * colours track the actual sky.
 */
export function getGreetingGradient(
  now: Date,
  sunrise: Date,
  sunset: Date,
  conditionCode: number,
): GradientStops {
  const position = resolveWindow(
    now.getTime(),
    sunrise.getTime(),
    sunset.getTime(),
  );

  const current = stopsToOklch(BASE_STOPS[position.window]);
  const next = stopsToOklch(BASE_STOPS[position.next]);

  const blended: OklchStops = {
    from: mixOklch(current.from, next.from, position.fraction),
    to: mixOklch(current.to, next.to, position.fraction),
  };

  const modified = applyModifier(
    blended,
    MODIFIERS[conditionBucket(conditionCode)],
  );

  return { from: oklchToHex(modified.from), to: oklchToHex(modified.to) };
}

/** How often the greeting recomputes. */
export const GRADIENT_TICK_MS = 60_000;
