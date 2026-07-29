"use client";

import {
  formatDayName,
  formatHour,
  formatTemperature,
  humidityLabel,
  temperatureUnit,
  type Units,
} from "@/lib/format";
import type { GradientStops } from "@/lib/gradient";
import type { DailyPoint, HourlyPoint, Wind } from "@/lib/weather/types";

import { DropletIcon, RainChanceIcon, SunIcon, WindIcon } from "./metric-icons";
import type { RailMode } from "./segmented-control";

type Props = {
  mode: RailMode;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  timeZone: string;
  units?: Units;
  /** Tints the pinned card's edge from the same stops as the greeting. */
  gradient?: GradientStops;
  /** Set when the weekly source failed, so the empty state can say why. */
  dailyUnavailable?: string;
};

/** The rail shows a day of hours; the bundle carries 48 for later screens. */
const HOURLY_CARDS = 24;

/**
 * Card width, shared between the pinned card and the rail's left padding so the
 * two cannot drift apart. Capped in rem and floored in vw, so two cards sit
 * comfortably on any phone with a third peeking.
 */
const CARD_WIDTH = "min(11.5rem, 52vw)";
const GAP = "0.75rem";
const EDGE = "1.25rem";

type CardContent = {
  key: number;
  heading: string;
  primary: number;
  secondary?: number;
  chance: number;
  condition: string;
  humidity: number;
  wind: Wind;
};

function toHourlyCard(point: HourlyPoint, timeZone: string): CardContent {
  return {
    key: point.time,
    heading: formatHour(point.time, timeZone),
    primary: point.temperature,
    chance: point.precipitationChance,
    condition: point.condition.text,
    humidity: point.humidity,
    wind: point.wind,
  };
}

function toDailyCard(point: DailyPoint, timeZone: string): CardContent {
  return {
    key: point.date,
    heading: formatDayName(point.date, timeZone),
    primary: point.high,
    secondary: point.low,
    chance: point.precipitationChance,
    condition: point.condition.text,
    humidity: point.humidity,
    wind: point.wind,
  };
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

function CardBody({ card, units }: { card: CardContent; units: Units }) {
  return (
    <>
      {/* Card headings are values, not labels, so they keep the Figma's title
          case rather than `.type-label`'s uppercase treatment. */}
      <p className="text-center text-sm font-normal text-text-dim">
        {card.heading}
      </p>

      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="type-numeric text-[2.75rem] leading-none">
          {formatTemperature(card.primary, units)}
          <span className="type-degree">°{temperatureUnit(units)}</span>
          {card.secondary !== undefined && (
            <span className="ml-0.5 align-bottom text-base text-text-dim">
              {`/${formatTemperature(card.secondary, units)}`}
            </span>
          )}
        </p>

        <span className="flex shrink-0 items-center gap-1 pt-1 text-[0.8125rem] text-text-dim">
          <RainChanceIcon size={17} />
          {Math.round(card.chance)}%
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3.5">
        <DetailRow icon={<SunIcon size={17} />}>{card.condition}</DetailRow>
        <DetailRow icon={<DropletIcon size={17} />}>
          {humidityLabel(card.humidity)}
        </DetailRow>
        <DetailRow icon={<WindIcon size={17} />}>
          {windRange(card.wind, units)}
        </DetailRow>
      </div>
    </>
  );
}

export function ForecastRail({
  mode,
  hourly,
  daily,
  timeZone,
  units = "metric",
  gradient,
  dailyUnavailable,
}: Props) {
  const cards: CardContent[] =
    mode === "hourly"
      ? hourly.slice(0, HOURLY_CARDS).map((point) => toHourlyCard(point, timeZone))
      : daily.map((point) => toDailyCard(point, timeZone));

  const [pinned, ...rest] = cards;

  return (
    <div
      id="forecast-rail"
      role="tabpanel"
      aria-labelledby={`rail-tab-${mode}`}
      aria-label={mode === "hourly" ? "Hourly forecast" : "Weekly forecast"}
      className="relative"
    >
      {!pinned ? (
        <p className="px-5 py-6 text-sm text-text-dim">
          {dailyUnavailable ?? "No forecast to show."}
        </p>
      ) : (
        <>
          {/*
            The first card holds its place while the rest slide underneath, which
            is how the Figma reads: "Today" stays put and the week scrolls past
            it. It sits outside the scroller rather than using `position: sticky`,
            because a sticky flex item does not hold inside a horizontally
            scrolling container (Decisions Log 37).
          */}
          <div
            className="card-raised card-pinned edge-gradient ww-fade absolute top-1 z-20 rounded-card px-4 py-5"
            style={
              {
                left: EDGE,
                width: CARD_WIDTH,
                ...(gradient
                  ? { "--edge-from": gradient.from, "--edge-to": gradient.to }
                  : {}),
              } as React.CSSProperties
            }
          >
            <CardBody card={pinned} units={units} />
          </div>

          <div
            // Padded so the scrolling cards begin to the right of the pinned
            // card and pass beneath it as the padding scrolls away.
            //
            // The mask hides the strip to the left of the pinned card. Without
            // it, cards scrolling past showed in the gutter between the screen
            // edge and the pinned card, which read as a rendering fault.
            className="overflow-x-auto overflow-y-clip [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{
              paddingLeft: `calc(${CARD_WIDTH} + ${GAP} + ${EDGE})`,
              scrollSnapType: "x proximity",
              WebkitOverflowScrolling: "touch",
              WebkitMaskImage: `linear-gradient(to right, transparent 0, transparent ${EDGE}, #000 ${EDGE})`,
              maskImage: `linear-gradient(to right, transparent 0, transparent ${EDGE}, #000 ${EDGE})`,
            }}
            tabIndex={0}
          >
            <ul className="flex gap-3 py-1 pr-5">
              {rest.map((card, index) => (
                <li
                  key={card.key}
                  className="card-raised ww-rise z-10 shrink-0 snap-start rounded-card px-4 py-5"
                  style={
                    {
                      width: CARD_WIDTH,
                      "--rise-delay": `${Math.min(index, 8) * 40}ms`,
                    } as React.CSSProperties
                  }
                >
                  <CardBody card={card} units={units} />
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
