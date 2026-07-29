"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Coordinates } from "@/lib/weather/coordinates";
import type { ErrorBody } from "@/lib/weather/errors";
import type { ForecastBundle } from "@/lib/weather/types";

export type ForecastState =
  | { status: "loading" }
  | {
      status: "ready";
      bundle: ForecastBundle;
      refreshing: boolean;
      /**
       * When set, this payload came from the service worker's cache rather than
       * the network, and is that many milliseconds old.
       */
      staleSince: number | null;
    }
  | { status: "error"; message: string };

/**
 * The service worker stamps cached forecasts with the time it stored them, so
 * a served-from-cache response can be told apart from a live one.
 */
const CACHED_AT_HEADER = "x-weatherwise-cached-at";

async function readError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as ErrorBody;
    return body.error.message;
  } catch {
    return "Could not load weather data.";
  }
}

export function useForecast({ latitude, longitude }: Coordinates) {
  const [state, setState] = useState<ForecastState>({ status: "loading" });

  // A refresh must not wipe the screen back to skeletons, so the existing
  // bundle is held while the new one is in flight.
  const bundleRef = useRef<ForecastBundle | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const existing = bundleRef.current;

      setState(
        existing
          ? {
              status: "ready",
              bundle: existing,
              refreshing: true,
              staleSince: null,
            }
          : { status: "loading" },
      );

      try {
        const response = await fetch(
          `/api/forecast?lat=${latitude}&lon=${longitude}`,
          { signal },
        );

        if (!response.ok) {
          setState({ status: "error", message: await readError(response) });
          return;
        }

        const cachedAt = response.headers.get(CACHED_AT_HEADER);
        const bundle = (await response.json()) as ForecastBundle;

        bundleRef.current = bundle;
        setState({
          status: "ready",
          bundle,
          refreshing: false,
          staleSince: cachedAt ? Number(cachedAt) : null,
        });
      } catch (error) {
        if (signal?.aborted) return;

        setState({
          status: "error",
          message:
            error instanceof TypeError
              ? "No connection. Check your network and try again."
              : "Could not load weather data.",
        });
      }
    },
    [latitude, longitude],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const refresh = useCallback(() => void load(), [load]);

  return { state, refresh };
}
