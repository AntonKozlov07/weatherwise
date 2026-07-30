"use client";

import { Map as MapLibreMap, NavigationControl } from "maplibre-gl";
import { useEffect, useRef, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { usePreferences } from "@/components/preferences-provider";
import { DEFAULT_LOCATION } from "@/lib/location";
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

/** CARTO Dark Matter, free and already the right value range for this design. */
const BASEMAP_STYLE =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const OVERLAY_SOURCE = "weather-overlay";
const OVERLAY_LAYER = "weather-overlay-layer";

/** Long enough to be a real failure rather than a slow connection. */
const LOAD_TIMEOUT_MS = 15_000;

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
      setStyleError("The map could not load. Check your connection.");
    });

    mapRef.current = map;

    // The container is sized by flex layout, which can settle after the map is
    // constructed. Without this the canvas keeps whatever size it saw first.
    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    // Nobody should watch a spinner with no idea whether it is working.
    const timeout = setTimeout(() => {
      setStyleError((current) => current ?? "The map is taking too long to load.");
    }, LOAD_TIMEOUT_MS);

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

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    return applyToStyle(map, () => {
      if (map.getLayer(OVERLAY_LAYER)) map.removeLayer(OVERLAY_LAYER);
      if (map.getSource(OVERLAY_SOURCE)) map.removeSource(OVERLAY_SOURCE);

      if (layer === "off") return;

      map.addSource(OVERLAY_SOURCE, {
        type: "raster",
        tiles: [tileTemplate(window.location.origin, layer)],
        tileSize: TILE_SIZE,
        maxzoom: MAX_TILE_ZOOM,
        attribution: "OpenWeatherMap",
      });

      map.addLayer({
        id: OVERLAY_LAYER,
        type: "raster",
        source: OVERLAY_SOURCE,
        paint: { "raster-opacity": opacity },
      });
    });
  }, [ready, layer, opacity]);

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
              className="ww-press type-label rounded-pill border border-hairline px-5 py-2 text-xs"
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

        {/* Sits above the floating nav rather than behind it. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[6.5rem] p-4">
          <p className="pointer-events-auto self-start rounded-pill bg-black/50 px-3 py-1 text-[0.6875rem] text-text-dim">
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
