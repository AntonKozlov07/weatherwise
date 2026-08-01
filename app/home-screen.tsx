"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { AlertBanner } from "@/components/alert-banner";
import { AppHeader } from "@/components/app-header";
import { BottomNav } from "@/components/bottom-nav";
import { ConditionThemeProvider } from "@/components/condition-theme-provider";
import { Greeting } from "@/components/greeting";
import { Hero } from "@/components/hero";
import { LocationSwitch } from "@/components/location-switch";
import { NowcastCard } from "@/components/nowcast-card";
import { OfflineBanner } from "@/components/offline-banner";
import { usePreferences } from "@/components/preferences-provider";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { ErrorState, HomeSkeleton } from "@/components/skeletons";
import { TimeScrubber } from "@/components/time-scrubber";
import { Timeline } from "@/components/timeline";
import { formatUpdatedAgo } from "@/lib/format";
import { useForecast } from "@/lib/hooks/use-forecast";
import { useGreetingGradient } from "@/lib/hooks/use-greeting-gradient";
import { useTilt } from "@/lib/hooks/use-tilt";
import { useVoiceLine } from "@/lib/hooks/use-voice-line";
import { DEFAULT_LOCATION } from "@/lib/location";
import { buildTimeline } from "@/lib/timeline/timeline";
import { activeLocation, type SavedLocation } from "@/lib/preferences";
import { readPreferences } from "@/lib/preferences-store";
import type { ForecastBundle } from "@/lib/weather/types";

/**
 * Split out because several hooks need a loaded bundle, and calling them above
 * the loading branch would mean calling hooks conditionally.
 */
function LoadedHome({
  bundle,
  staleSince,
  name,
  units,
  alertBanners,
  motionEffects,
  locations,
  activeLocationId,
}: {
  bundle: ForecastBundle;
  staleSince: number | null;
  name: string;
  units: "metric" | "imperial";
  alertBanners: boolean;
  motionEffects: boolean;
  locations: SavedLocation[];
  activeLocationId: string | null;
}) {
  const gradient = useGreetingGradient(bundle.current.condition, bundle.astronomy);

  // Lifted to the screen rather than owned by the hero, so the greeting and the
  // card read the same tilt and lean together. Two hooks would mean two
  // smoothing loops a frame apart.
  const tilt = useTilt(motionEffects);

  // Owned here rather than in the hero, so there is one line per screen and the
  // request is not repeated by every component that wants to show it.
  const advice = useVoiceLine(bundle.current, bundle.hourly, bundle.location);

  const rows = useMemo(
    () =>
      buildTimeline({
        hourly: bundle.hourly,
        daily: bundle.daily,
        astronomy: bundle.astronomy,
        now: bundle.current.observedAt,
      }),
    // The exact fields read, not the whole bundle. The two lint rules disagree
    // here: the compiler rule rejects `[bundle]` because it cannot preserve the
    // memoisation, and exhaustive-deps wants it back. The compiler is right
    // about the thing that matters, so its version stands and the older rule is
    // silenced on this line alone.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bundle.hourly, bundle.daily, bundle.astronomy, bundle.current.observedAt],
  );

  /**
   * The scrubber moves over hours only. Days are on the same timeline but a
   * scrubber that steps from 3pm to Thursday in one notch is not a scrubber,
   * it is two controls wearing one coat.
   */
  const hourPositions = useMemo(
    () =>
      rows
        .map((row, index) => (row.kind === "hour" ? index : -1))
        .filter((index) => index !== -1),
    [rows],
  );

  const [scrubIndex, setScrubIndex] = useState(0);

  // Clamped rather than reset: a refresh that drops one past hour should keep
  // the user roughly where they were, not throw them back to now.
  const safeIndex = Math.min(scrubIndex, Math.max(0, hourPositions.length - 1));
  const activeRowIndex = hourPositions[safeIndex] ?? -1;
  const activeRow = rows[activeRowIndex];

  const scrubbed = safeIndex !== 0;

  // At now the hero shows the observation, which carries readings the hourly
  // forecast does not. Away from now it shows the forecast for that hour.
  const view =
    scrubbed && activeRow?.kind === "hour"
      ? {
          time: activeRow.time,
          condition: activeRow.condition,
          temperature: activeRow.temperature,
          feelsLike: bundle.hourly.find((hour) => hour.time === activeRow.time)
            ?.feelsLike ?? activeRow.temperature,
          humidity:
            bundle.hourly.find((hour) => hour.time === activeRow.time)?.humidity ??
            bundle.current.humidity,
          uvIndex:
            bundle.hourly.find((hour) => hour.time === activeRow.time)?.uvIndex ??
            0,
          windSpeed:
            bundle.hourly.find((hour) => hour.time === activeRow.time)?.wind.speed ??
            bundle.current.wind.speed,
        }
      : {
          time: bundle.current.observedAt,
          condition: bundle.current.condition,
          temperature: bundle.current.temperature,
          feelsLike: bundle.current.feelsLike,
          humidity: bundle.current.humidity,
          uvIndex: bundle.current.uvIndex,
          windSpeed: bundle.current.wind.speed,
        };

  return (
    <div className="flex flex-col gap-stack pb-6">
      {/* Sets the gradient stops and accent on the document root from this
          location's own condition and sun times. Renders nothing itself. */}
      <ConditionThemeProvider
        current={bundle.current}
        astronomy={bundle.astronomy}
      />

      {staleSince !== null && <OfflineBanner staleSince={staleSince} />}

      {/* In the flow, so it pushes content down rather than covering it.
          Renders nothing when there is nothing to show. */}
      {alertBanners && (
        <AlertBanner
          alerts={bundle.alerts}
          timeZone={bundle.location.timeZone}
          now={bundle.fetchedAt}
        />
      )}

      <div className="ww-rise page-gutter">
        <Greeting
          name={name}
          gradient={gradient}
          timeZone={bundle.location.timeZone}
          tilt={tilt}
        />
        <p className="type-label mt-1 text-2xs">
          {bundle.location.name} · {formatUpdatedAgo(bundle.current.observedAt)}
        </p>
      </div>

      {/* Only where there is a choice to make. */}
      <LocationSwitch locations={locations} activeId={activeLocationId} />

      <div
        className="ww-rise"
        style={{ "--rise-delay": "60ms" } as React.CSSProperties}
      >
        <Hero
          view={view}
          current={bundle.current}
          hourly={bundle.hourly}
          locationName={bundle.location.name}
          timeZone={bundle.location.timeZone}
          units={units}
          tilt={tilt}
          scrubbed={scrubbed}
          airQuality={bundle.airQuality}
          windGust={bundle.current.wind.gust ?? bundle.current.wind.speed}
          astronomy={bundle.astronomy}
          advice={advice}
        />
      </div>

      {hourPositions.length > 1 && (
        <div
          className="ww-rise"
          style={{ "--rise-delay": "90ms" } as React.CSSProperties}
        >
          <TimeScrubber
            times={hourPositions.map((index) => rows[index].time)}
            timeZone={bundle.location.timeZone}
            index={safeIndex}
            onChange={setScrubIndex}
            nowIndex={0}
          />
        </div>
      )}

      {/* Absent entirely where One Call publishes no minutely data. */}
      <div
        className="ww-rise page-gutter"
        style={{ "--rise-delay": "120ms" } as React.CSSProperties}
      >
        <NowcastCard nowcast={bundle.nowcast} />
      </div>

      <div
        className="ww-rise"
        style={{ "--rise-delay": "150ms" } as React.CSSProperties}
      >
        <Timeline
          rows={rows}
          timeZone={bundle.location.timeZone}
          units={units}
          now={bundle.current.observedAt}
          activeIndex={activeRowIndex}
          onSelect={(index) => {
            // Tapping a day is not a scrub target, so only hour rows move it.
            const position = hourPositions.indexOf(index);
            if (position !== -1) setScrubIndex(position);
          }}
        />
      </div>
    </div>
  );
}

export function HomeScreen() {
  const router = useRouter();
  const preferences = usePreferences();
  const scrollRef = useRef<HTMLDivElement>(null);

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
      <PullToRefresh onRefresh={refresh} scrollerRef={scrollRef}>
        <div className="flex h-full min-h-0 flex-col">
          <AppHeader
            locationName={
              state.status === "ready" ? state.bundle.location.name : undefined
            }
          />

          {/*
            The timeline is long by design, so this screen scrolls where the
            others fit. The scroll lives here rather than on the page, so the
            header and nav stay put and nothing is clipped (Decisions Log 52).
          */}
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
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
                motionEffects={preferences.motionEffects}
                locations={preferences.locations}
                activeLocationId={preferences.activeLocationId}
              />
            )}
          </div>

          <BottomNav />
        </div>
      </PullToRefresh>
    </div>
  );
}
