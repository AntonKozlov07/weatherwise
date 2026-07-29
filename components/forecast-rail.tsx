"use client";

import {
  formatDayName,
  formatHour,
  formatTemperature,
  humidityLabel,
  temperatureUnit,
  type Units,
} from "@/lib/format";
import type { DailyPoint, HourlyPoint, Wind } from "@/lib/weather/types";

import {
  DropletIcon,
  RainChanceIcon,
  SunIcon,
  WindIcon,
} from "./metric-icons";
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

/**
 * Cards carry the full detail row set from the Figma, so they are sized for it
 * rather than for a bare temperature. Capped in rem and floored in vw so two
 * sit comfortably on any phone with a third peeking, which is what signals the
 * row scrolls.
 */
function Card({
  children,
  index,
}: {
  children: React.ReactNode;
  index: number;
}) {
  return (
    <li
      className="ww-rise w-[min(11.5rem,52vw)] shrink-0 snap-start rounded-card bg-surface-raised px-4 py-4"
      // Cards settle in sequence. Capped so a long weekly list does not take a
      // full second to finish arriving.
      style={{ "--rise-delay": `${Math.min(index, 8) * 40}ms` } as React.CSSProperties}
    >
      {children}
    </li>
  );
}

/** Card headings are values, not labels, so they keep the Figma's title case. */
function Heading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-sm font-normal text-text-dim">{children}</p>
  );
}

function DetailRow({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-text-dim">{icon}</span>
      <span className="truncate text-[0.8125rem] leading-tight">{children}</span>
    </div>
  );
}

/** "20km/h - 30km/h" when gusts are reported, otherwise the single figure. */
function windRange(wind: Wind, units: Units): string {
  const unit = units === "metric" ? "km/h" : "mph";
  const convert = (value: number) =>
    Math.round(units === "metric" ? value : value / 1.609344);

  if (wind.gust === null || wind.gust <= wind.speed) {
    return `${convert(wind.speed)}${unit}`;
  }

  return `${convert(wind.speed)}${unit} - ${convert(wind.gust)}${unit}`;
}

function TempAndRain({
  primary,
  secondary,
  chance,
  units,
}: {
  primary: number;
  secondary?: number;
  chance: number;
  units: Units;
}) {
  return (
    <div className="flex items-start justify-between gap-2">
      <p className="type-numeric text-[2.75rem] leading-none">
        {formatTemperature(primary, units)}
        <span className="type-degree">°{temperatureUnit(units)}</span>
        {secondary !== undefined && (
          <span className="ml-0.5 align-bottom text-base text-text-dim">
            /{formatTemperature(secondary, units)}
          </span>
        )}
      </p>

      <span className="flex shrink-0 items-center gap-1 pt-1 text-[0.8125rem] text-text-dim">
        <RainChanceIcon size={17} />
        {Math.round(chance)}%
      </span>
    </div>
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
            ? hourly.slice(0, HOURLY_CARDS).map((point, index) => (
                <Card key={point.time} index={index}>
                  <Heading>{formatHour(point.time, timeZone)}</Heading>

                  <div className="mt-2">
                    <TempAndRain
                      primary={point.temperature}
                      chance={point.precipitationChance}
                      units={units}
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2.5">
                    <DetailRow icon={<SunIcon size={17} />}>
                      {point.condition.text}
                    </DetailRow>
                    <DetailRow icon={<DropletIcon size={17} />}>
                      {humidityLabel(point.humidity)}
                    </DetailRow>
                    <DetailRow icon={<WindIcon size={17} />}>
                      {windRange(point.wind, units)}
                    </DetailRow>
                  </div>
                </Card>
              ))
            : daily.map((point, index) => (
                <Card key={point.date} index={index}>
                  <Heading>{formatDayName(point.date, timeZone)}</Heading>

                  <div className="mt-2">
                    <TempAndRain
                      primary={point.high}
                      secondary={point.low}
                      chance={point.precipitationChance}
                      units={units}
                    />
                  </div>

                  <div className="mt-4 flex flex-col gap-2.5">
                    <DetailRow icon={<SunIcon size={17} />}>
                      {point.condition.text}
                    </DetailRow>
                    <DetailRow icon={<DropletIcon size={17} />}>
                      {humidityLabel(point.humidity)}
                    </DetailRow>
                    <DetailRow icon={<WindIcon size={17} />}>
                      {windRange(point.wind, units)}
                    </DetailRow>
                  </div>
                </Card>
              ))}
        </ul>
      )}
    </div>
  );
}
