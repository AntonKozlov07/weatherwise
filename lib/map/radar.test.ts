import { describe, expect, it } from "vitest";

import { parseRadarTimeline, radarTileUrl } from "./radar";

const PAYLOAD = {
  host: "https://tilecache.rainviewer.com",
  radar: {
    past: [
      { time: 1_785_279_000, path: "/v2/radar/af06e9fa055e" },
      { time: 1_785_279_600, path: "/v2/radar/bb17f0ab166f" },
    ],
    nowcast: [{ time: 1_785_280_200, path: "/v2/radar/nowcast_c1" }],
  },
};

describe("parseRadarTimeline", () => {
  it("flattens past and nowcast into one ordered list", () => {
    const timeline = parseRadarTimeline(PAYLOAD);

    expect(timeline?.frames).toHaveLength(3);
    // Forecast frames must be distinguishable: the scrubber labels them.
    expect(timeline?.frames.map((frame) => frame.forecast)).toEqual([
      false,
      false,
      true,
    ]);
  });

  // Playback starts at the present, not two hours ago.
  it("points nowIndex at the most recent observed frame", () => {
    expect(parseRadarTimeline(PAYLOAD)?.nowIndex).toBe(1);
  });

  it("falls back to the first frame when there is no past radar", () => {
    const timeline = parseRadarTimeline({
      ...PAYLOAD,
      radar: { past: [], nowcast: PAYLOAD.radar.nowcast },
    });

    expect(timeline?.nowIndex).toBe(0);
  });

  it("drops frames missing a time or a path", () => {
    const timeline = parseRadarTimeline({
      host: PAYLOAD.host,
      radar: { past: [{ time: 1 }, { path: "/x" }, PAYLOAD.radar.past[0]] },
    });

    expect(timeline?.frames).toHaveLength(1);
  });

  it("returns null rather than a half-built timeline", () => {
    expect(parseRadarTimeline(null)).toBeNull();
    expect(parseRadarTimeline({ radar: PAYLOAD.radar })).toBeNull();
    expect(parseRadarTimeline({ host: PAYLOAD.host })).toBeNull();
    expect(parseRadarTimeline({ host: PAYLOAD.host, radar: {} })).toBeNull();
  });
});

describe("radarTileUrl", () => {
  it("builds a MapLibre tile template from the host and frame path", () => {
    const timeline = parseRadarTimeline(PAYLOAD)!;

    expect(radarTileUrl(timeline, timeline.frames[0])).toBe(
      "https://tilecache.rainviewer.com/v2/radar/af06e9fa055e/512/{z}/{x}/{y}/4/1_1.png",
    );
  });

  it("gives each frame its own template, which is what animates the layer", () => {
    const timeline = parseRadarTimeline(PAYLOAD)!;

    expect(radarTileUrl(timeline, timeline.frames[0])).not.toBe(
      radarTileUrl(timeline, timeline.frames[1]),
    );
  });
});
