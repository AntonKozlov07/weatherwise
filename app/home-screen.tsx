"use client";

import { useState } from "react";

import { AlertBanner } from "@/components/alert-banner";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { ForecastRail } from "@/components/forecast-rail";
import { Greeting } from "@/components/greeting";
import { NowCard } from "@/components/now-card";
import { SegmentedControl, type RailMode } from "@/components/segmented-control";
import { ErrorState, HomeSkeleton } from "@/components/skeletons";
import { formatUpdatedAgo } from "@/lib/format";
import { useForecast } from "@/lib/hooks/use-forecast";
import { DEFAULT_LOCATION } from "@/lib/location";

/** Rain chance for the now card, taken from the hours immediately ahead. */
function nearTermRainChance(chances: number[]): number {
  return chances.length === 0 ? 0 : Math.max(...chances);
}

export function HomeScreen() {
  const { state, refresh } = useForecast(DEFAULT_LOCATION);
  const [mode, setMode] = useState<RailMode>("hourly");

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        locationName={
          state.status === "ready" ? state.bundle.location.name : undefined
        }
      />

      {state.status === "loading" && <HomeSkeleton />}

      {state.status === "error" && (
        <ErrorState message={state.message} onRetry={refresh} />
      )}

      {state.status === "ready" && (
        <div className="flex flex-col gap-6">
          {state.bundle.alerts.length > 0 && (
            <AlertBanner alerts={state.bundle.alerts} />
          )}

          <div className="px-5">
            <Greeting
              condition={state.bundle.current.condition}
              astronomy={state.bundle.astronomy}
              timeZone={state.bundle.location.timeZone}
            />
            <p className="type-label mt-2 text-[0.6875rem]">
              {state.bundle.location.name} ·{" "}
              {formatUpdatedAgo(state.bundle.current.observedAt)}
            </p>
          </div>

          <NowCard
            current={state.bundle.current}
            timeZone={state.bundle.location.timeZone}
            precipitationChance={nearTermRainChance(
              state.bundle.hourly.slice(0, 6).map((h) => h.precipitationChance),
            )}
          />

          {/* Open space where the Figma had the arrow element (CLAUDE.md). */}
          <div className="pt-2">
            <SegmentedControl value={mode} onChange={setMode} />
          </div>

          <ForecastRail
            mode={mode}
            hourly={state.bundle.hourly}
            daily={state.bundle.daily}
            timeZone={state.bundle.location.timeZone}
            dailyUnavailable={
              state.bundle.sources.openMeteo.ok
                ? undefined
                : "The weekly forecast is unavailable right now."
            }
          />
        </div>
      )}

      <BottomNav />
    </div>
  );
}
