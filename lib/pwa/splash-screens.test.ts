import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { appleStartupImages } from "./splash-screens";

const PUBLIC_DIR = path.resolve(__dirname, "../../public");

describe("appleStartupImages", () => {
  it("emits a portrait and a landscape entry per device", () => {
    expect(appleStartupImages).toHaveLength(46);
  });

  it("has no duplicate media queries", () => {
    const queries = appleStartupImages.map((image) => image.media);
    expect(new Set(queries).size).toBe(queries.length);
  });

  // The filenames are derived arithmetically from device size and pixel ratio.
  // If pwa-asset-generator ever changes its naming, iOS silently falls back to a
  // white launch screen rather than erroring, so assert the files are really there.
  it("points at splash images that exist on disk", () => {
    const missing = appleStartupImages
      .map((image) => image.url)
      .filter((url) => !existsSync(path.join(PUBLIC_DIR, url)));

    expect(missing).toEqual([]);
  });
});
