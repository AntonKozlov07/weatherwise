/**
 * Colour maths for the greeting gradient. No dependencies and no React, so the
 * engine can be tuned and tested on its own.
 *
 * Everything interpolates in OKLCH because sRGB interpolation drags mixes
 * through muddy greys: amber to white in sRGB dips in chroma halfway, which is
 * exactly the transition the greeting spends its morning in.
 *
 * Conversions follow Björn Ottosson's OKLab derivation.
 */

export type Oklch = {
  /** Perceptual lightness, 0 to 1. */
  l: number;
  /** Chroma, 0 upward. Around 0.37 is the sRGB maximum. */
  c: number;
  /** Hue in degrees, 0 to 360. Meaningless when chroma is 0. */
  h: number;
};

/** Below this, a colour is grey and its hue carries no information. */
const ACHROMATIC = 1e-4;

function srgbToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  return channel <= 0.0031308
    ? channel * 12.92
    : 1.055 * channel ** (1 / 2.4) - 0.055;
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

export function parseHex(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.trim().replace(/^#/, "");

  const expanded =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((character) => character + character)
          .join("")
      : cleaned;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Not a hex colour: ${hex}`);
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16) / 255,
    g: Number.parseInt(expanded.slice(2, 4), 16) / 255,
    b: Number.parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

function toHexChannel(channel: number): string {
  return Math.round(clamp01(channel) * 255)
    .toString(16)
    .padStart(2, "0");
}

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = parseHex(hex);

  const lr = srgbToLinear(r);
  const lg = srgbToLinear(g);
  const lb = srgbToLinear(b);

  const long = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const medium = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const short = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );

  const l = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short;
  const a = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
  const bb = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;

  const c = Math.sqrt(a * a + bb * bb);
  const h = c < ACHROMATIC ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;

  return { l, c, h };
}

export function oklchToHex({ l, c, h }: Oklch): string {
  const radians = (h * Math.PI) / 180;
  const a = c * Math.cos(radians);
  const b = c * Math.sin(radians);

  const long = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const medium = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const short = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const r = 4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short;
  const g = -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short;
  const bl = -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short;

  // Out-of-gamut results are clipped per channel. Proper gamut mapping would
  // reduce chroma until the colour fits, but every stop in this design is
  // already inside sRGB and only extreme modifiers can push one out.
  return `#${toHexChannel(linearToSrgb(r))}${toHexChannel(
    linearToSrgb(g),
  )}${toHexChannel(linearToSrgb(bl))}`;
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

/**
 * Hue is circular, so interpolation takes the short way round: amber to violet
 * should not sweep back through green.
 *
 * When one end is grey its hue is arbitrary, so the chromatic end's hue is held
 * instead. Without this, fading a colour to white would swing the hue on the way.
 */
function lerpHue(from: Oklch, to: Oklch, amount: number): number {
  if (from.c < ACHROMATIC && to.c < ACHROMATIC) return 0;
  if (from.c < ACHROMATIC) return to.h;
  if (to.c < ACHROMATIC) return from.h;

  let delta = ((to.h - from.h + 540) % 360) - 180;
  if (delta === -180) delta = 180;

  return (from.h + delta * amount + 360) % 360;
}

export function mixOklch(from: Oklch, to: Oklch, amount: number): Oklch {
  const t = clamp01(amount);

  return {
    l: lerp(from.l, to.l, t),
    c: lerp(from.c, to.c, t),
    h: lerpHue(from, to, t),
  };
}

export function mixHex(from: string, to: string, amount: number): string {
  return oklchToHex(mixOklch(hexToOklch(from), hexToOklch(to), amount));
}

/** Pulls chroma toward zero. `amount` of 0.15 removes 15% of the chroma. */
export function desaturate(colour: Oklch, amount: number): Oklch {
  return { ...colour, c: colour.c * (1 - clamp01(amount)) };
}
