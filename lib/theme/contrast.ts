/**
 * WCAG contrast maths.
 *
 * Exists so the condition themes are checked rather than eyeballed: every
 * generated background is asserted against the text colour in
 * `condition-theme.test.ts`. sRGB relative luminance per WCAG 2.1, which is a
 * different curve from the OKLCH lightness the gradient engine uses and is not
 * interchangeable with it.
 */

export type Rgb = { r: number; g: number; b: number };

export function parseHex(hex: string): Rgb {
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
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance({ r, g, b }: Rgb): number {
  return (
    0.2126 * channelLuminance(r) +
    0.7152 * channelLuminance(g) +
    0.0722 * channelLuminance(b)
  );
}

export function contrastRatio(a: string | Rgb, b: string | Rgb): number {
  const first = relativeLuminance(typeof a === "string" ? parseHex(a) : a);
  const second = relativeLuminance(typeof b === "string" ? parseHex(b) : b);

  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);

  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Flattens a translucent colour onto an opaque one.
 *
 * The condition wash is a low-alpha tint over the base, so the colour text
 * actually sits on is the composite, not the base. Checking against the base
 * alone would report a contrast the user never experiences.
 */
export function compositeOver(
  tint: Rgb,
  alpha: number,
  background: string | Rgb,
): Rgb {
  const base = typeof background === "string" ? parseHex(background) : background;

  return {
    r: Math.round(tint.r * alpha + base.r * (1 - alpha)),
    g: Math.round(tint.g * alpha + base.g * (1 - alpha)),
    b: Math.round(tint.b * alpha + base.b * (1 - alpha)),
  };
}

/** WCAG AA: 4.5:1 for body text, 3:1 for large text and UI components. */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;
