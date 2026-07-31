"use client";

import {
  Map as MapLibreMap,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { usePreferences } from "@/components/preferences-provider";
import { formatTime } from "@/lib/format";
import { DEFAULT_LOCATION } from "@/lib/location";
import { radarTileUrl, type RadarTimeline } from "@/lib/map/radar";
import {
  MAX_TILE_ZOOM,
  TILE_SIZE,
  WEATHER_TILE_LAYERS,
  tileTemplate,
  type WeatherTileLayer,
} from "@/lib/map/layers";
import { activeLocation } from "@/lib/preferences";

import "maplibre-gl/dist/maplibre-gl.css";

type Layer = WeatherTileLayer | "off";

/**
 * CARTO Dark Matter as raster tiles, declared inline.
 *
 * This was a hosted vector style. Vector needs a style fetch, a sprite fetch, a
 * glyph fetch, and tile parsing in a Web Worker, and on device the style parsed
 * while nothing ever painted, which points at that pipeline rather than at
 * WebGL or the container. Raster removes all of it: no external style document
 * and no worker-side geometry work, just images drawn to the canvas
 * (Decisions Log 51).
 *
 * Same basemap, same palette. Labels are baked into the tiles instead of being
 * rendered from fonts, which is the only visible difference.
 */
const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    basemap: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      ],
      tileSize: 256,
      attribution: "CARTO, OpenStreetMap",
    },
  },
  layers: [
    // Painted under everything, so the canvas is never transparent even before
    // the first tile arrives.
    { id: "background", type: "background", paint: { "background-color": "#16191d" } },
    { id: "basemap", type: "raster", source: "basemap" },
  ],
};

const OVERLAY_SOURCE = "weather-overlay";
const OVERLAY_LAYER = "weather-overlay-layer";

/** Long enough to be a real failure rather than a slow connection. */
const LOAD_TIMEOUT_MS = 15_000;

/** Slow enough to read the movement, fast enough to see the whole loop. */
const FRAME_MS = 500;

/**
 * Runs a style mutation once the style can accept one.
 *
 * `addSource` throws before the style has loaded, and `isStyleLoaded()` can
 * still be false on the `load` event itself. Bailing out in that case left the
 * overlay never added at all, because nothing retried afterwards. This defers
 * instead, and returns a cleanup that cancels a pending run.
 */
function applyToStyle(
  map: InstanceType<typeof MapLibreMap>,
  mutate: () => void,
): () => void {
  let cancelled = false;

  const run = () => {
    if (cancelled || !map.getContainer().isConnected) return;
    try {
      mutate();
    } catch {
      // A style swap mid-flight can invalidate the call. The next dependency
      // change re-runs it, and a missing overlay is not worth a crash.
    }
  };

  if (map.isStyleLoaded()) {
    run();
    return () => {
      cancelled = true;
    };
  }

  map.once("idle", run);

  return () => {
    cancelled = true;
    map.off("idle", run);
  };
}

export function WeatherMap() {
  const preferences = usePreferences();
  const saved = activeLocation(preferences);
  const centre = saved
    ? { latitude: saved.latitude, longitude: saved.longitude }
    : DEFAULT_LOCATION;

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<InstanceType<typeof MapLibreMap> | null>(null);

  const [styleParsed, setStyleParsed] = useState(false);
  const [ready, setReady] = useState(false);
  const [styleError, setStyleError] = useState<string | null>(null);

  const [layer, setLayer] = useState<Layer>("precipitation");
  const [opacity, setOpacity] = useState(0.7);

  // Radar timelapse. Precipitation is the only layer with a time dimension.
  const [timeline, setTimeline] = useState<RadarTimeline | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [radarError, setRadarError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // WebGL is the one hard requirement, and losing it produces a blank canvas
    // with no error of its own. Checked first so the message says so.
    const probe = document.createElement("canvas");
    const gl =
      probe.getContext("webgl2") ??
      probe.getContext("webgl") ??
      probe.getContext("experimental-webgl");

    // These two are setState in an effect body, which the lint rule warns about
    // in general and is right to. Here they are one-time capability failures
    // that must reach the screen instead of leaving a blank rectangle, and there
    // is no external system to subscribe to for "WebGL does not exist".
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!gl) {
      setStyleError("This browser cannot draw the map: WebGL is unavailable.");
      return;
    }

    let map: InstanceType<typeof MapLibreMap>;

    try {
      map = new MapLibreMap({
        container: containerRef.current,
        style: BASEMAP_STYLE,
        center: [centre.longitude, centre.latitude],
        zoom: 7,
        attributionControl: false,
      });
    } catch (error) {
      // Construction throws on a missing worker, a bad style URL, or a WebGL
      // context that reports present then fails. Without this the component
      // simply rendered nothing and the overlay span forever.
      setStyleError(
        `The map could not start: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }
    /* eslint-enable react-hooks/set-state-in-effect */

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");

    // Two separate notions of "ready", because they answer different questions.
    //
    // `styleParsed` only says the style JSON arrived, which is what the loading
    // overlay cares about. `ready` says the map can take layers, which needs the
    // sources settled. Tying the overlay to the stricter one left it spinning
    // whenever the map had not painted a frame.
    map.on("styledata", () => setStyleParsed(true));
    map.on("load", () => {
      setStyleParsed(true);
      setReady(true);
    });
    map.on("idle", () => setReady(true));

    map.on("error", (event) => {
      // A single missing tile is not worth taking the screen down for; a failed
      // style is, because it leaves nothing but a blank rectangle.
      if ((event as { sourceId?: string }).sourceId) return;

      // The vendor's own message, not a generic one. A blank map with "check
      // your connection" is unactionable when the real cause is a style parse
      // failure or a blocked request.
      const detail = (event as { error?: { message?: string } }).error?.message;
      setStyleError(
        detail ? `The map could not load: ${detail}` : "The map could not load.",
      );
    });

    mapRef.current = map;

    // The container is sized by flex layout, which can settle after the map is
    // constructed. Without this the canvas keeps whatever size it saw first.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    // Nobody should watch a spinner with no idea whether it is working. Cleared
    // the moment the style parses: previously it fired regardless, so a map that
    // had loaded fine still showed "taking too long" fifteen seconds later.
    const timeout = setTimeout(() => {
      if (map.isStyleLoaded() || map.loaded()) return;
      setStyleError((current) => current ?? "The map is taking too long to load.");
    }, LOAD_TIMEOUT_MS);

    const cancelTimeout = () => clearTimeout(timeout);
    map.on("load", cancelTimeout);
    map.on("idle", cancelTimeout);

    return () => {
      clearTimeout(timeout);
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      setStyleParsed(false);
      // Reset, or the next map (React mounts effects twice in development)
      // inherits a true `ready` and the layer effect runs against a style that
      // has not loaded yet.
      setReady(false);
    };
    // Centre is read once. Re-centring on a location change would fight a user
    // who has panned away, so switching cities takes effect on the next visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Radar frame index, fetched once. Only precipitation animates.
  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/radar", { signal: controller.signal });

        if (!response.ok) {
          setRadarError("Radar frames are unavailable.");
          return;
        }

        const data = (await response.json()) as RadarTimeline;
        setTimeline(data);
        setFrameIndex(data.nowIndex);
      } catch {
        if (!controller.signal.aborted) {
          setRadarError("Radar frames are unavailable.");
        }
      }
    })();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    return applyToStyle(map, () => {
      if (map.getLayer(OVERLAY_LAYER)) map.removeLayer(OVERLAY_LAYER);
      if (map.getSource(OVERLAY_SOURCE)) map.removeSource(OVERLAY_SOURCE);

      if (layer === "off") return;

      // Precipitation comes from RainViewer so it can be scrubbed through time.
      // Wind is a single OpenWeatherMap snapshot; it has no frames.
      const source =
        layer === "precipitation" && timeline
          ? {
              tiles: [radarTileUrl(timeline, timeline.frames[frameIndex] ?? timeline.frames[0])],
              tileSize: 512,
              attribution: "RainViewer",
            }
          : layer === "wind"
            ? {
                tiles: [tileTemplate(window.location.origin, "wind")],
                tileSize: TILE_SIZE,
                maxzoom: MAX_TILE_ZOOM,
                attribution: "OpenWeatherMap",
              }
            : null;

      if (!source) return;

      map.addSource(OVERLAY_SOURCE, { type: "raster", ...source });
      map.addLayer({
        id: OVERLAY_LAYER,
        type: "raster",
        source: OVERLAY_SOURCE,
        paint: { "raster-opacity": opacity },
      });
    });
  }, [ready, layer, opacity, timeline, frameIndex]);

  // Autoplay is never automatic: the quality bar says the radar must not play on
  // its own, and it is also off under reduced motion.
  useEffect(() => {
    if (!playing || !timeline) return;

    const timer = setInterval(() => {
      setFrameIndex((current) => (current + 1) % timeline.frames.length);
    }, FRAME_MS);

    return () => clearInterval(timer);
  }, [playing, timeline]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.getLayer(OVERLAY_LAYER)) {
      map.setPaintProperty(OVERLAY_LAYER, "raster-opacity", opacity);
    }
  }, [ready, opacity]);

  return (
    // Full screen, not a pane above the nav. The map fills the shell and the
    // nav floats over it, so the canvas runs edge to edge (Decisions Log 49).
    <div className="screen relative">
      <div className="absolute inset-0">
        {/* Sized directly rather than with `absolute inset-0`: maplibre-gl.css
            sets `position: relative` on `.maplibregl-map` and loads after
            Tailwind, so absolute positioning was overridden and the container
            collapsed (Decisions Log 40). */}
        <div ref={containerRef} className="h-full w-full" />

        {!styleParsed && !styleError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg">
            <svg
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="ww-spin text-accent"
              aria-hidden="true"
            >
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            </svg>
            <p role="status" className="text-sm text-text-dim">
              Loading map
            </p>
          </div>
        )}

        {styleError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-bg px-8 text-center">
            <p className="text-base">{styleError}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ww-press type-label rounded-pill border border-border px-5 py-2 text-xs"
            >
              Try again
            </button>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-4">
          <div className="card-floating pointer-events-auto flex gap-1 self-start rounded-pill p-1">
            {[...WEATHER_TILE_LAYERS, "off" as const].map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLayer(option)}
                aria-pressed={layer === option}
                className={`ww-press rounded-pill px-3 py-1.5 text-sm capitalize transition-colors ${
                  layer === option ? "bg-surface-raised text-text" : "text-text-dim"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {layer !== "off" && (
            <label className="card-floating pointer-events-auto flex items-center gap-3 self-start rounded-pill px-4 py-2">
              <span className="type-label text-2xs">Opacity</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
                className="w-28 accent-accent"
              />
            </label>
          )}
        </div>

        {/* Timelapse scrubber, above the floating nav. */}
        {layer === "precipitation" && timeline && (
          <div className="pointer-events-none absolute inset-x-0 bottom-[9.5rem] px-4">
            <div className="card-floating pointer-events-auto flex items-center gap-3 rounded-card px-4 py-3">
              <button
                type="button"
                onClick={() => setPlaying((current) => !current)}
                aria-label={playing ? "Pause radar" : "Play radar"}
                className="ww-press shrink-0 rounded-pill bg-surface-raised p-2"
              >
                {playing ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="6" y="5" width="4" height="14" rx="1" />
                    <rect x="14" y="5" width="4" height="14" rx="1" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5.5v13l11-6.5-11-6.5Z" />
                  </svg>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <input
                  type="range"
                  min={0}
                  max={timeline.frames.length - 1}
                  step={1}
                  value={frameIndex}
                  onChange={(event) => {
                    setPlaying(false);
                    setFrameIndex(Number(event.target.value));
                  }}
                  aria-label="Radar time"
                  className="w-full accent-accent"
                />
                <p className="mt-1 text-xs text-text-dim">
                  {(() => {
                    const frame = timeline.frames[frameIndex];
                    if (!frame) return "";
                    const label = formatTime(
                      frame.time * 1000,
                      Intl.DateTimeFormat().resolvedOptions().timeZone,
                    );
                    return frame.forecast ? `${label} · forecast` : label;
                  })()}
                </p>
              </div>
            </div>
          </div>
        )}

        {layer === "precipitation" && radarError && !timeline && (
          <p
            role="status"
            className="card-floating pointer-events-auto absolute inset-x-4 bottom-[9.5rem] rounded-pill px-4 py-2 text-sm text-text-dim"
          >
            {radarError}
          </p>
        )}

        {/* Sits above the floating nav rather than behind it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[6.5rem] p-4">
          <p className="pointer-events-auto self-start rounded-pill bg-black/50 px-3 py-1 text-xs text-text-dim">
            <a
              href="https://openweathermap.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              OpenWeatherMap
            </a>
            {" · "}
            <a
              href="https://carto.com/attributions"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              CARTO
            </a>
            {" · OpenStreetMap"}
          </p>
        </div>
      </div>

      {/* Above the map, and pushed to the bottom of the shell. */}
      <div className="relative z-10 mt-auto">
        <BottomNav />
      </div>
    </div>
  );
}
