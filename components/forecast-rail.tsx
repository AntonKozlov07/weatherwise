"use client";

import {
  formatDayName,
  formatHour,
  formatTemperature,
  temperatureUnit,
  type Units,
} from "@/lib/format";
import type { DailyPoint, HourlyPoint } from "@/lib/weather/types";

import { WeatherIcon } from "./weather-icon";
import type { RailMode } from "./segmented-control";

type Props = {
  mode: RailMode;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  timeZone: string;
  units?: Units;
  /** Set when the weekly source failed, so the empty state can say why. */
  dailyUnavailable?: string;
};

/** The rail shows a day of hours; the bundle carries 48 for later screens. */
const HOURLY_CARDS = 24;

function Card({ children }: { children: React.ReactNode }) {
  return (
    <li className="w-[5.5rem] shrink-0 snap-start rounded-inner bg-surface-raised px-3 py-3">
      {children}
    </li>
  );
}

/**
 * Card headings are data, not labels, so they keep the Figma's title case
 * rather than taking `.type-label`'s uppercase treatment. "2pm" and "Monday"
 * read as the value; "2PM" reads as a column header.
 */
const CARD_HEADING = "text-[0.6875rem] font-medium text-text-dim";

function Precipitation({ chance }: { chance: number }) {
  return (
    <p className="mt-1 text-[0.625rem] leading-tight text-text-dim">
      {Math.round(chance)}% Rain
    </p>
  );
}

export function ForecastRail({
  mode,
  hourly,
  daily,
  timeZone,
  units = "metric",
  dailyUnavailable,
}: Props) {
  const empty = mode === "hourly" ? hourly.length === 0 : daily.length === 0;

  return (
    <div
      id="forecast-rail"
      role="tabpanel"
      aria-labelledby={`rail-tab-${mode}`}
      // The only horizontally scrolling element in the app. `overflow-y-hidden`
      // keeps it from claiming vertical scroll, and the rail is padded rather
      // than the page so cards can bleed to the screen edge.
      className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
      tabIndex={0}
      aria-label={mode === "hourly" ? "Hourly forecast" : "Weekly forecast"}
    >
      {empty ? (
        <p className="px-5 py-6 text-sm text-text-dim">
          {dailyUnavailable ?? "No forecast to show."}
        </p>
      ) : (
        <ul className="flex gap-3 px-5 py-1">
          {mode === "hourly"
            ? hourly.slice(0, HOURLY_CARDS).map((point) => (
                <Card key={point.time}>
                  <p className={CARD_HEADING}>
                    {formatHour(point.time, timeZone)}
                  </p>
                  <div className="my-2 flex justify-center">
                    <WeatherIcon condition={point.condition} size={38} />
                  </div>
                  <p className="type-numeric text-lg">
                    {formatTemperature(point.temperature, units)}
                    <span className="type-degree">°{temperatureUnit(units)}</span>
                  </p>
                  <Precipitation chance={point.precipitationChance} />
                </Card>
              ))
            : daily.map((point) => (
                <Card key={point.date}>
                  <p className={CARD_HEADING}>
                    {formatDayName(point.date, timeZone)}
                  </p>
                  <div className="my-2 flex justify-center">
                    <WeatherIcon condition={point.condition} size={38} />
                  </div>
                  <p className="type-numeric text-lg">
                    {formatTemperature(point.high, units)}
                    <span className="type-degree">°</span>
                    <span className="text-sm text-text-dim">
                      {`/${formatTemperature(point.low, units)}`}
                    </span>
                  </p>
                  <p className="mt-1 truncate text-[0.6875rem] text-text-dim">
                    {point.condition.text}
                  </p>
                  <Precipitation chance={point.precipitationChance} />
                </Card>
              ))}
        </ul>
      )}
    </div>
  );
}
