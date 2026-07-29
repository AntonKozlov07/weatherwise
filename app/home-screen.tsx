"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AlertBanner } from "@/components/alert-banner";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { ForecastRail } from "@/components/forecast-rail";
import { Greeting } from "@/components/greeting";
import { NowCard } from "@/components/now-card";
import { OfflineBanner } from "@/components/offline-banner";
import { usePreferences } from "@/components/preferences-provider";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { SegmentedControl, type RailMode } from "@/components/segmented-control";
import { ErrorState, HomeSkeleton } from "@/components/skeletons";
import { formatUpdatedAgo } from "@/lib/format";
import { useForecast } from "@/lib/hooks/use-forecast";
import { useGreetingGradient } from "@/lib/hooks/use-greeting-gradient";
import { DEFAULT_LOCATION } from "@/lib/location";
import { activeLocation } from "@/lib/preferences";
import { readPreferences } from "@/lib/preferences-store";
import type { ForecastBundle } from "@/lib/weather/types";

/** Rain chance for the now card, taken from the hours immediately ahead. */
function nearTermRainChance(chances: number[]): number {
  return chances.length === 0 ? 0 : Math.max(...chances);
}

/**
 * Split out because the gradient hook needs a condition and astronomy, which
 * only exist once the bundle has loaded. Calling it above the loading branch
 * would mean calling a hook conditionally.
 */
function LoadedHome({
  bundle,
  staleSince,
  name,
  units,
  alertBanners,
  mode,
  onModeChange,
}: {
  bundle: ForecastBundle;
  staleSince: number | null;
  name: string;
  units: "metric" | "imperial";
  alertBanners: boolean;
  mode: RailMode;
  onModeChange: (mode: RailMode) => void;
}) {
  const gradient = useGreetingGradient(bundle.current.condition, bundle.astronomy);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {staleSince !== null && <OfflineBanner staleSince={staleSince} />}

      {alertBanners && bundle.alerts.length > 0 && (
        <AlertBanner alerts={bundle.alerts} />
      )}

      <div className="ww-rise px-5">
        <Greeting name={name} gradient={gradient} timeZone={bundle.location.timeZone} />
        <p className="type-label mt-1 text-[0.625rem]">
          {bundle.location.name} · {formatUpdatedAgo(bundle.current.observedAt)}
        </p>
      </div>

      <div
        className="ww-rise"
        style={{ "--rise-delay": "60ms" } as React.CSSProperties}
      >
        <NowCard
          current={bundle.current}
          timeZone={bundle.location.timeZone}
          units={units}
          gradient={gradient}
          precipitationChance={nearTermRainChance(
            bundle.hourly.slice(0, 6).map((hour) => hour.precipitationChance),
          )}
        />
      </div>

      {/* The open space the Figma's arrow element used to occupy. It absorbs
          whatever height is left, so the screen fills exactly once. */}
      <div className="min-h-3 flex-1" />

      <div
        className="ww-rise"
        style={{ "--rise-delay": "120ms" } as React.CSSProperties}
      >
        <SegmentedControl value={mode} onChange={onModeChange} />
      </div>

      <ForecastRail
        mode={mode}
        hourly={bundle.hourly}
        daily={bundle.daily}
        timeZone={bundle.location.timeZone}
        units={units}
        gradient={gradient}
      />
    </div>
  );
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
    <div className="screen relative overflow-hidden">
      <PullToRefresh onRefresh={refresh}>
        <div className="flex h-full min-h-0 flex-col">
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
            <LoadedHome
              bundle={state.bundle}
              staleSince={state.staleSince}
              name={preferences.name}
              units={preferences.units}
              alertBanners={preferences.alertBanners}
              mode={mode}
              onModeChange={setMode}
            />
          )}

          <BottomNav />
        </div>
      </PullToRefresh>
    </div>
  );
}
