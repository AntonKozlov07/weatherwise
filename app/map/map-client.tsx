"use client";

import dynamic from "next/dynamic";

/**
 * MapLibre touches `window` at import time, so it must not be pulled into the
 * server render. `ssr: false` is only allowed inside a Client Component in
 * Next 16, which is what this file exists to be.
 *
 * Loading it lazily also keeps the largest dependency in the app out of the
 * shared bundle, so the home screen does not pay for a screen it may never open.
 */
const WeatherMap = dynamic(
  () => import("./weather-map").then((module) => module.WeatherMap),
  {
    ssr: false,
    loading: () => (
      <div className="ww-shimmer min-h-dvh w-full" aria-label="Loading map" />
    ),
  },
);

export function MapClient() {
  return <WeatherMap />;
}
