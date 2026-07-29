"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AlertBanner } from "@/components/alert-banner";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { ForecastRail } from "@/components/forecast-rail";
import { Greeting } from "@/components/greeting";
import { NowCard } from "@/components/now-card";
import { usePreferences } from "@/components/preferences-provider";
import { readPreferences } from "@/lib/preferences-store";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { SegmentedControl, type RailMode } from "@/components/segmented-control";
import { ErrorState, HomeSkeleton } from "@/components/skeletons";
import { formatUpdatedAgo } from "@/lib/format";
import { useForecast } from "@/lib/hooks/use-forecast";
import { DEFAULT_LOCATION } from "@/lib/location";
import { activeLocation } from "@/lib/preferences";

/** Rain chance for the now card, taken from the hours immediately ahead. */
function nearTermRainChance(chances: number[]): number {
  return chances.length === 0 ? 0 : Math.max(...chances);
}

export function HomeScreen() {
  const router = useRouter();
  const preferences = usePreferences();
  const [mode, setMode] = useState<RailMode>("hourly");

  const saved = activeLocation(preferences);
  const coordinates = saved
    ? { latitude: saved.latitude, longitude: saved.longitude }
    : DEFAULT_LOCATION;

  const { state, refresh } = useForecast(coordinates);

  // Read storage directly rather than trusting the rendered value. On the first
  // commit after hydration that value can still be the server snapshot, whose
  // `onboarded` is false, which would bounce a returning user through
  // onboarding on every launch.
  useEffect(() => {
    if (!readPreferences().onboarded) router.replace("/onboarding");
  }, [router]);

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <PullToRefresh onRefresh={refresh}>
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
            <div className="flex flex-1 flex-col gap-6">
              {preferences.alertBanners && state.bundle.alerts.length > 0 && (
                <AlertBanner alerts={state.bundle.alerts} />
              )}

              <div className="ww-rise px-5">
                <Greeting
                  name={preferences.name}
                  condition={state.bundle.current.condition}
                  astronomy={state.bundle.astronomy}
                  timeZone={state.bundle.location.timeZone}
                />
                <p className="type-label mt-2 text-[0.6875rem]">
                  {state.bundle.location.name} ·{" "}
                  {formatUpdatedAgo(state.bundle.current.observedAt)}
                </p>
              </div>

              <div className="ww-rise" style={{ "--rise-delay": "60ms" } as React.CSSProperties}>
                <NowCard
                  current={state.bundle.current}
                  timeZone={state.bundle.location.timeZone}
                  units={preferences.units}
                  precipitationChance={nearTermRainChance(
                    state.bundle.hourly
                      .slice(0, 6)
                      .map((hour) => hour.precipitationChance),
                  )}
                />
              </div>

              {/* The open space the Figma's arrow element used to occupy. It
                  takes two thirds of the slack on a tall phone, so the extra
                  height reads as deliberate spacing rather than pooling into a
                  dead gap above the nav. */}
              <div className="min-h-6 flex-[2]" />

              <div className="ww-rise" style={{ "--rise-delay": "120ms" } as React.CSSProperties}>
                <SegmentedControl value={mode} onChange={setMode} />
              </div>

              <ForecastRail
                mode={mode}
                hourly={state.bundle.hourly}
                daily={state.bundle.daily}
                timeZone={state.bundle.location.timeZone}
                units={preferences.units}
                dailyUnavailable={
                  state.bundle.sources.openMeteo.ok
                    ? undefined
                    : "The weekly forecast is unavailable right now."
                }
              />

              <div className="min-h-2 flex-[1]" />
            </div>
          )}

          <BottomNav />
        </div>
      </PullToRefresh>
    </div>
  );
}
