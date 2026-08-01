"use client";

import { useState } from "react";

import { Temperature } from "@/components/temperature";
import { WeatherFX, WindFX } from "@/components/weather-fx";
import { WeatherIcon } from "@/components/weather-icon";
import { formatTime, formatWind, type Units } from "@/lib/format";
import { conditionTheme } from "@/lib/theme/condition-theme";
import { CLIMATE_GRADIENT, CLIMATE_LABEL } from "@/lib/world/cities";
import type { WorldSnapshot } from "@/lib/world/world";

/**
 * A city on the world board.
 *
 * Closed, it is coloured by climate alone: not by condition, not by
 * temperature. Eight cards each reacting to their own weather is a fruit salad,
 * and the thing worth seeing across a grid is that these are different kinds of
 * places. Open, there is only one card, and condition takes over along with the
 * rain, snow, wind and fog (Decisions Log 102).
 *
 * The same rule applies to motion. Nothing animates in the grid, which is what
 * keeps eight cards cheap; the animation belongs to the card you opened.
 */
export function WorldCard({
  city,
  units,
}: {
  city: WorldSnapshot;
  units: Units;
}) {
  const [open, setOpen] = useState(false);

  const climate = CLIMATE_GRADIENT[city.climate];

  // Open, the card is themed by what the weather is doing there, using the same
  // machinery as the home screen rather than a second palette.
  const theme = open
    ? conditionTheme(city.condition.code, city.observedAt, null, null)
    : null;

  const stops = theme?.gradient ?? climate;

  return (
    <button
      type="button"
      onClick={() => setOpen((value) => !value)}
      aria-expanded={open}
      className="ww-world-card relative overflow-hidden rounded-card p-4 text-left"
      data-open={open || undefined}
      style={{
        backgroundImage: `linear-gradient(150deg, ${stops[0]} 0%, ${stops[1]} 55%, ${stops[2]} 100%)`,
      }}
    >
      {open && (
        <>
          <WeatherFX condition={city.condition} />
          <WindFX gustKph={city.windKph} />
        </>
      )}

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm">{city.name}</p>
          <p className="type-label truncate text-2xs text-[color:var(--on-band-dim)]">
            {open ? city.condition.label : CLIMATE_LABEL[city.climate]}
          </p>
        </div>

        <WeatherIcon condition={city.condition} size={open ? 44 : 30} className="shrink-0" />
      </div>

      <p className="type-temp relative mt-3 text-[2rem]">
        <Temperature celsius={city.temperature} units={units} />
      </p>

      {/* Simple metrics, and only once opened. */}
      {open && (
        <dl className="relative mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-2xs">
          <Metric label="Feels">
            <Temperature celsius={city.feelsLike} units={units} />
          </Metric>
          <Metric label="Humidity">{Math.round(city.humidity)}%</Metric>
          <Metric label="Wind">{formatWind(city.windKph, units)}</Metric>
          <Metric label="Local time">{formatTime(city.observedAt, city.timeZone)}</Metric>
        </dl>
      )}
    </button>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="type-label text-2xs text-[color:var(--on-band-dim)]">{label}</dt>
      <dd className="tabular-nums">{children}</dd>
    </div>
  );
}
