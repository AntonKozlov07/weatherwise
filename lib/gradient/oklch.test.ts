import { describe, expect, it } from "vitest";

import {
  desaturate,
  hexToOklch,
  mixHex,
  mixOklch,
  oklchToHex,
  parseHex,
} from "./oklch";

describe("parseHex", () => {
  it("accepts long and short form", () => {
    expect(parseHex("#ffffff")).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHex("#fff")).toEqual({ r: 1, g: 1, b: 1 });
    expect(parseHex("000000")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("rejects anything else rather than silently returning black", () => {
    expect(() => parseHex("#12345")).toThrow(/Not a hex colour/);
    expect(() => parseHex("rebeccapurple")).toThrow(/Not a hex colour/);
  });
});

describe("hex to OKLCH and back", () => {
  it("round trips every design token without drift", () => {
    for (const hex of [
      "#2B3A67", "#FF9E7A", "#FFB347", "#FFF3D6", "#FFD84D",
      "#FFFFFF", "#FF7B54", "#6B4A8F", "#9AA3AE", "#4A5158",
      "#8A919C", "#5B7A99", "#D9E8F5", "#6B5BA8", "#12151A",
    ]) {
      expect(oklchToHex(hexToOklch(hex)).toUpperCase()).toBe(hex.toUpperCase());
    }
  });

  it("reads greys as having no chroma", () => {
    expect(hexToOklch("#808080").c).toBeLessThan(0.001);
  });

  it("puts white at full lightness and black at zero", () => {
    expect(hexToOklch("#FFFFFF").l).toBeCloseTo(1, 3);
    expect(hexToOklch("#000000").l).toBeCloseTo(0, 3);
  });
});

describe("mixOklch", () => {
  it("returns the endpoints at 0 and 1", () => {
    expect(mixHex("#FF7B54", "#6B4A8F", 0).toUpperCase()).toBe("#FF7B54");
    expect(mixHex("#FF7B54", "#6B4A8F", 1).toUpperCase()).toBe("#6B4A8F");
  });

  it("clamps out-of-range amounts instead of extrapolating", () => {
    expect(mixHex("#FF7B54", "#6B4A8F", -1)).toBe(mixHex("#FF7B54", "#6B4A8F", 0));
    expect(mixHex("#FF7B54", "#6B4A8F", 2)).toBe(mixHex("#FF7B54", "#6B4A8F", 1));
  });

  it("takes the short way round the hue circle", () => {
    // 350 to 10 degrees should pass through 0, not sweep down through 180.
    const from = { l: 0.7, c: 0.1, h: 350 };
    const to = { l: 0.7, c: 0.1, h: 10 };

    expect(mixOklch(from, to, 0.5).h).toBeCloseTo(0, 5);
  });

  it("holds the chromatic hue when mixing toward grey", () => {
    // This is what keeps midday's amber from swinging hue as it fades to white.
    const amber = hexToOklch("#FFD84D");
    const white = hexToOklch("#FFFFFF");

    expect(mixOklch(amber, white, 0.5).h).toBeCloseTo(amber.h, 5);
  });

  it("does not dip in chroma halfway, which is the reason for OKLCH", () => {
    const from = hexToOklch("#FFB347");
    const to = hexToOklch("#FF7B54");
    const middle = mixOklch(from, to, 0.5);

    expect(middle.c).toBeGreaterThanOrEqual(Math.min(from.c, to.c) - 1e-9);
  });
});

describe("desaturate", () => {
  it("removes the requested share of chroma and leaves hue and lightness", () => {
    const colour = hexToOklch("#FFB347");
    const drained = desaturate(colour, 0.35);

    expect(drained.c).toBeCloseTo(colour.c * 0.65, 6);
    expect(drained.h).toBe(colour.h);
    expect(drained.l).toBe(colour.l);
  });

  it("fully desaturated is grey", () => {
    expect(desaturate(hexToOklch("#FFB347"), 1).c).toBe(0);
  });
});
