"use client";

import { createPortal } from "react-dom";

import { Glint } from "@/components/glint";
import { Temperature } from "@/components/temperature";
import { WeatherFX, WindFX } from "@/components/weather-fx";
import { WeatherIcon } from "@/components/weather-icon";
import { formatTime, formatWind, type Units } from "@/lib/format";
import { useExpandingPanel } from "@/lib/hooks/use-expanding-panel";
import type { Tilt } from "@/lib/hooks/use-tilt";
import { conditionThemeFor } from "@/lib/theme/condition-theme";
import { CLIMATE_GRADIENT, CLIMATE_LABEL } from "@/lib/world/cities";
import type { WorldSnapshot } from "@/lib/world/world";

/**
 * A city on the world board.
 *
 * Closed, it is a square coloured by climate alone: not by condition, not by
 * temperature. Eight cards each reacting to their own weather is a fruit salad,
 * and what is worth seeing across a grid is that these are different kinds of
 * place (Decisions Log 102).
 *
 * Opened, it pops up over the board rather than growing in the grid, using the
 * same machinery as the hero: same FLIP, same backdrop, same ways out. A card
 * that expanded in place pushed the rest of the grid around it, which read as
 * the layout breaking rather than as something opening (Decisions Log 106).
 * Condition, the weather animation and the metrics all arrive with it.
 */
export function WorldCard({
  city,
  units,
  tilt,
}: {
  city: WorldSnapshot;
  units: Units;
  tilt: Tilt;
}) {
  const { phase, expanded, open, close, sourceRef, panelRef, dragHandlers, dragStyle } =
    useExpandingPanel();

  const climate = CLIMATE_GRADIENT[city.climate];

  // Opened, the card is themed by what the weather is doing there, using the
  // same theming as the home screen rather than a second palette.
  // The vendor reports whether it is light there, which is more reliable than
  // inferring it, and there are no sun times in this payload to infer from.
  const theme = conditionThemeFor(
    city.condition.code,
    city.condition.isDay ? "day" : "night",
  );
  const stops = expanded ? theme.gradient : climate;

  const background = `linear-gradient(150deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`;

  return (
    <>
      <button
        ref={sourceRef as React.RefObject<HTMLButtonElement>}
        type="button"
        onClick={open}
        aria-expanded={expanded}
        className="ww-world-card relative overflow-hidden rounded-card p-4 text-left"
        style={{ backgroundImage: `linear-gradient(150deg, ${climate[0]} 0%, ${climate[1]} 55%, ${climate[2]} 100%)` }}
      >
        {/* The glint is the one thing the closed cards do carry. It is light on
            a surface rather than weather, so it does not make the grid busy the
            way eight sets of falling rain would. */}
        <Glint tilt={tilt} scale={0.6} />

        <div className="relative flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm">{city.name}</p>
            <p className="type-label truncate text-2xs text-[color:var(--on-band-dim)]">
              {CLIMATE_LABEL[city.climate]}
            </p>
          </div>

          <WeatherIcon condition={city.condition} size={28} className="shrink-0" />
        </div>

        <p className="type-temp relative mt-auto text-[1.75rem]">
          <Temperature celsius={city.temperature} units={units} />
        </p>
      </button>

      {expanded &&
        createPortal(
          <div
            className="ww-hero-backdrop fixed inset-0 z-50"
            data-phase={phase}
            onClick={close}
          >
            <div
              ref={panelRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={`${city.name} in detail`}
              className="ww-world-panel absolute inset-x-gutter"
              style={dragStyle}
              onClick={(event) => event.stopPropagation()}
              {...dragHandlers}
            >
              <span className="ww-hero-grab" aria-hidden="true" />

              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="ww-world-open relative block w-full overflow-hidden rounded-card p-5 text-left"
                style={{ backgroundImage: background }}
              >
                <WeatherFX condition={city.condition} />
                <WindFX gustKph={city.windKph} />
                <Glint tilt={tilt} />

                <div className="relative flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base">{city.name}</p>
                    <p className="type-label truncate text-2xs text-[color:var(--on-band-dim)]">
                      {city.condition.label}
                    </p>
                  </div>

                  <WeatherIcon condition={city.condition} size={56} className="shrink-0" />
                </div>

                <p className="type-temp relative mt-3 text-[3rem]">
                  <Temperature celsius={city.temperature} units={units} withUnit />
                </p>
              </button>

              <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-xs">
                <Metric label="Feels" index={0}>
                  <Temperature celsius={city.feelsLike} units={units} />
                </Metric>
                <Metric label="Humidity" index={1}>
                  {Math.round(city.humidity)}%
                </Metric>
                <Metric label="Wind" index={2}>
                  {formatWind(city.windKph, units)}
                </Metric>
                <Metric label="Local time" index={3}>
                  {formatTime(city.observedAt, city.timeZone)}
                </Metric>
              </dl>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Metric({
  label,
  index,
  children,
}: {
  label: string;
  index: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="ww-stagger flex items-baseline justify-between gap-2 border-b border-border pb-2"
      style={{ "--i": index } as React.CSSProperties}
    >
      <dt className="type-label text-2xs">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
