"use client";

import { useEffect, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { Leaderboard } from "@/components/leaderboard";
import { WorldCard } from "@/components/world-card";
import { usePreferences } from "@/components/preferences-provider";
import { DEFAULT_LOCATION } from "@/lib/location";
import { useTilt } from "@/lib/hooks/use-tilt";
import { activeLocation } from "@/lib/preferences";
import type { OnThisDay } from "@/lib/history/on-this-day";
import { HOME_CITY_ID, type WorldSnapshot } from "@/lib/world/world";

/**
 * Explore.
 *
 * Three things about weather that are not the forecast: what this date has done
 * before, what the rest of the world is doing now, and something worth knowing.
 * It replaced a news feed, which was in the app because the original brief said
 * so rather than because a weather app needs one (Decisions Log 105).
 *
 * One continuous scroll rather than sections behind a control. There are three
 * things, and a control to choose between three things is more interface than
 * the content justifies.
 *
 * Every record on this screen is computed from observed measurements. Nothing
 * here is recalled by a model, which is what makes stating it outright safe.
 */

type HistoryState = {
  history: OnThisDay | null;
  facts: string[];
};

export function Explore() {
  const preferences = usePreferences();
  const [world, setWorld] = useState<WorldSnapshot[]>([]);
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [loading, setLoading] = useState(true);

  // One tilt for the whole board, so eight cards catch the light together
  // rather than running eight smoothing loops a frame apart.
  const tilt = useTilt(preferences.motionEffects);

  const saved = activeLocation(preferences);
  const coordinates = saved
    ? { latitude: saved.latitude, longitude: saved.longitude }
    : DEFAULT_LOCATION;

  const key = `${coordinates.latitude},${coordinates.longitude}`;

  useEffect(() => {
    let cancelled = false;

    // Fetched together but failing apart: the world board going down must not
    // take the history with it, and neither is worth an error screen.
    Promise.all([
      fetch(
        `/api/world?lat=${coordinates.latitude}&lon=${coordinates.longitude}` +
          `&name=${encodeURIComponent(saved?.name ?? "Your city")}`,
      )
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch(`/api/history?lat=${coordinates.latitude}&lon=${coordinates.longitude}`)
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]).then(([worldPayload, historyPayload]) => {
      if (cancelled) return;

      setWorld(worldPayload?.cities ?? []);
      setHistory(
        historyPayload
          ? {
              history: historyPayload.history ?? null,
              facts: historyPayload.facts ?? [],
            }
          : null,
      );
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="screen relative">
      <header className="page-gutter pt-2">
        <h1 className="screen-title">Explore</h1>
      </header>

      <div className="screen-scroll page-gutter flex flex-col gap-8 pb-6 pt-5">
        <section className="ww-rise flex flex-col gap-3">
          <h2 className="type-label text-2xs">
            On this day{saved ? ` in ${saved.name}` : ""}
          </h2>

          {loading && <div className="ww-shimmer h-28 rounded-card" />}

          {!loading && history?.history && (
            <>
              <ul className="flex flex-col gap-2">
                {history.facts.map((fact) => (
                  <li
                    key={fact}
                    className="rounded-card bg-surface px-4 py-3 text-sm leading-relaxed text-text-dim"
                  >
                    {fact}
                  </li>
                ))}
              </ul>

              <p className="type-label text-2xs text-text-faint">
                Measured, {history.history.span.from} to {history.history.span.to}
              </p>
            </>
          )}

          {!loading && !history?.history && (
            <p className="text-sm text-text-dim">No records for this date here yet.</p>
          )}
        </section>

        <section
          className="ww-rise flex flex-col gap-3"
          style={{ "--rise-delay": "60ms" } as React.CSSProperties}
        >
          <h2 className="type-label text-2xs">Around the world</h2>

          {loading && (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="ww-shimmer aspect-square rounded-card" />
              ))}
            </div>
          )}

          {!loading && world.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {/* The user's own city is ranked but not drawn as a climate card:
                  it is on the home screen already, and a card for it here would
                  be the same weather twice. */}
              {world.filter((city) => city.id !== HOME_CITY_ID).map((city) => (
                <WorldCard
                  key={city.id}
                  city={city}
                  units={preferences.units}
                  tilt={tilt}
                />
              ))}
            </div>
          )}

          {!loading && world.length === 0 && (
            <p className="text-sm text-text-dim">Could not reach the world board.</p>
          )}
        </section>

        <section
          className="ww-rise flex flex-col gap-3"
          style={{ "--rise-delay": "120ms" } as React.CSSProperties}
        >
          <h2 className="type-label text-2xs">Where you stand</h2>

          {loading && <div className="ww-shimmer h-64 rounded-card" />}

          {!loading && world.length > 0 && (
            <Leaderboard cities={world} units={preferences.units} />
          )}
        </section>
      </div>

      <BottomNav />
    </div>
  );
}
