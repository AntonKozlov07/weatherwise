/**
 * RainViewer radar frames, for the precipitation timelapse.
 *
 * OpenWeatherMap's Weather Maps 1.0 tiles are a single current snapshot per
 * layer with no time dimension, so they cannot answer "when does the rain get
 * here". RainViewer publishes the past two hours plus a nowcast as discrete
 * frames, keyless, which is exactly that question (Decisions Log 53).
 *
 * So precipitation is RainViewer and animated; wind stays OpenWeatherMap and
 * static. Attribution for both is on the map.
 */

export type RadarFrame = {
  /** Epoch seconds, as RainViewer reports it. */
  time: number;
  /** Path fragment, combined with the host to build a tile URL. */
  path: string;
  /** Nowcast frames are forecast, not observed, and are labelled as such. */
  forecast: boolean;
};

export type RadarTimeline = {
  host: string;
  frames: RadarFrame[];
  /** Index of the most recent observed frame, where playback starts. */
  nowIndex: number;
};

type RawFrame = { time?: number; path?: string };

type RawResponse = {
  host?: string;
  radar?: { past?: RawFrame[]; nowcast?: RawFrame[] };
};

export const RADAR_API = "https://api.rainviewer.com/public/weather-maps.json";

/** Frames land every 10 minutes, so this is fresh without hammering them. */
export const RADAR_REVALIDATE_SECONDS = 300;

function toFrames(raw: RawFrame[] | undefined, forecast: boolean): RadarFrame[] {
  return (raw ?? [])
    .filter(
      (frame): frame is Required<RawFrame> =>
        typeof frame.time === "number" && typeof frame.path === "string",
    )
    .map((frame) => ({ time: frame.time, path: frame.path, forecast }));
}

export function parseRadarTimeline(payload: unknown): RadarTimeline | null {
  if (typeof payload !== "object" || payload === null) return null;

  const raw = payload as RawResponse;
  if (typeof raw.host !== "string") return null;

  const past = toFrames(raw.radar?.past, false);
  const nowcast = toFrames(raw.radar?.nowcast, true);
  const frames = [...past, ...nowcast];

  if (frames.length === 0) return null;

  return {
    host: raw.host,
    frames,
    // The last observed frame is "now". With no past frames at all, fall back
    // to the first frame rather than an index of -1.
    nowIndex: past.length > 0 ? past.length - 1 : 0,
  };
}

/** 512px tiles, colour scheme 4 (dark), smoothed, snow shown separately. */
export function radarTileUrl(timeline: RadarTimeline, frame: RadarFrame): string {
  return `${timeline.host}${frame.path}/512/{z}/{x}/{y}/4/1_1.png`;
}
