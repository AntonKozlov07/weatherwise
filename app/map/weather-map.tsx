"use client";

import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { usePreferences } from "@/components/preferences-provider";
import { formatTime } from "@/lib/format";
import { radarTileUrl, type RadarTimeline } from "@/lib/map/radar";
import { DEFAULT_LOCATION } from "@/lib/location";
import { activeLocation } from "@/lib/preferences";

import "maplibre-gl/dist/maplibre-gl.css";

type Layer = "precipitation" | "wind" | "off";

/** CARTO Dark Matter, free and already the right value range for this design. */
const BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const RADAR_SOURCE = "radar";
const RADAR_LAYER = "radar-layer";
const WIND_SOURCE = "wind";
const WIND_LAYER = "wind-layer";

/** Slow enough to read the movement, fast enough to see the whole loop. */
const FRAME_MS = 500;

/**
 * Runs a style mutation once the style can accept one.
 *
 * `addSource` throws before the style has loaded, and `isStyleLoaded()` can
 * still be false on the `load` event itself. Bailing out in that case left the
 * radar layer never added at all, because nothing retried afterwards. This
 * defers instead, and returns a cleanup that cancels a pending run.
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
  const [ready, setReady] = useState(false);

  const [layer, setLayer] = useState<Layer>("precipitation");
  const [opacity, setOpacity] = useState(0.7);
  const [timeline, setTimeline] = useState<RadarTimeline | null>(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new MapLibreMap({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: [centre.longitude, centre.latitude],
      zoom: 7,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("load", () => setReady(true));
    mapRef.current = map;

    // The container is sized by flex layout, which can settle after the map is
    // constructed. Without this the canvas keeps whatever size it saw first.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      // Reset, or the next map (React mounts effects twice in development)
      // inherits a true `ready` and the layer effects run against a style that
      // has not loaded yet.
      setReady(false);
    };
    // Centre is read once. Re-centring on a location change would fight a user
    // who has panned away, so switching cities takes effect on the next visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/radar", { signal: controller.signal });
        if (!response.ok) {
          setError("Radar is unavailable right now.");
          return;
        }

        const data = (await response.json()) as RadarTimeline;
        setTimeline(data);
        setFrameIndex(data.nowIndex);
      } catch {
        if (!controller.signal.aborted) {
          setError("Radar is unavailable right now.");
        }
      }
    })();

    return () => controller.abort();
  }, []);

  // Radar source and layer, rebuilt whenever the visible frame changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    return applyToStyle(map, () => {
      if (map.getLayer(RADAR_LAYER)) map.removeLayer(RADAR_LAYER);
      if (map.getSource(RADAR_SOURCE)) map.removeSource(RADAR_SOURCE);

      if (layer !== "precipitation" || !timeline) return;

      const frame = timeline.frames[frameIndex];
      if (!frame) return;

      map.addSource(RADAR_SOURCE, {
        type: "raster",
        tiles: [radarTileUrl(timeline, frame)],
        tileSize: 512,
        attribution: "RainViewer",
      });

      map.addLayer({
        id: RADAR_LAYER,
        type: "raster",
        source: RADAR_SOURCE,
        paint: { "raster-opacity": opacity },
      });
    });
  }, [ready, layer, timeline, frameIndex, opacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    return applyToStyle(map, () => {
      if (map.getLayer(WIND_LAYER)) map.removeLayer(WIND_LAYER);
      if (map.getSource(WIND_SOURCE)) map.removeSource(WIND_SOURCE);

      if (layer !== "wind") return;

      map.addSource(WIND_SOURCE, {
        type: "raster",
        // Through our own proxy, because the key cannot be in a tile template.
        tiles: [`${window.location.origin}/api/wind/{z}/{x}/{y}`],
        tileSize: 256,
        maxzoom: 12,
      });

      map.addLayer({
        id: WIND_LAYER,
        type: "raster",
        source: WIND_SOURCE,
        paint: { "raster-opacity": opacity },
      });
    });
  }, [ready, layer, opacity]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    for (const id of [RADAR_LAYER, WIND_LAYER]) {
      if (map.getLayer(id)) map.setPaintProperty(id, "raster-opacity", opacity);
    }
  }, [ready, opacity]);

  // Autoplay is off under reduced motion, per the quality bar.
  useEffect(() => {
    if (!playing || !timeline) return;

    const timer = setInterval(() => {
      setFrameIndex((current) => (current + 1) % timeline.frames.length);
    }, FRAME_MS);

    return () => clearInterval(timer);
  }, [playing, timeline]);

  const togglePlay = useCallback(() => setPlaying((current) => !current), []);

  const frame = timeline?.frames[frameIndex];
  // Radar times read in the device's zone, not the saved location's: the
  // scrubber is about when the frame was captured relative to now.
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <div className="screen">
      {/* `min-h-0` matters: without it this flex child resolved to zero height
          and MapLibre rendered into nothing at all. */}
      <div className="relative min-h-0 flex-1">
        {/* Sized directly rather than with `absolute inset-0`: maplibre-gl.css
            sets `position: relative` on `.maplibregl-map` and loads after
            Tailwind, so the absolute positioning was overridden and the
            container collapsed to zero height (Decisions Log 40). */}
        <div ref={containerRef} className="h-full w-full" />

        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-3 p-4">
          <div className="pointer-events-auto card-floating flex gap-1 self-start rounded-pill p-1">
            {(["precipitation", "wind", "off"] as const).map((option) => (
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
            <label className="pointer-events-auto card-floating flex items-center gap-3 self-start rounded-pill px-4 py-2">
              <span className="type-label text-[0.625rem]">Opacity</span>
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

        {error && (
          <p className="card-floating absolute left-4 top-1/2 rounded-inner px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-4">
          {layer === "precipitation" && timeline && frame && (
            <div className="pointer-events-auto card-floating flex items-center gap-3 rounded-card px-4 py-3">
              <button
                type="button"
                onClick={togglePlay}
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
                  {formatTime(frame.time * 1000, deviceZone)}
                  {frame.forecast && " · forecast"}
                </p>
              </div>
            </div>
          )}

          {/* RainViewer's terms require visible attribution. */}
          <p className="pointer-events-auto self-start rounded-pill bg-black/50 px-3 py-1 text-[0.6875rem] text-text-dim">
            <a
              href="https://www.rainviewer.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              RainViewer
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

      <BottomNav />
    </div>
  );
}
