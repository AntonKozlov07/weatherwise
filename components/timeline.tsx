"use client";

import { memo } from "react";

import { WeatherIcon } from "@/components/weather-icon";
import { Temperature } from "@/components/temperature";
import {
  formatDayName,
  formatHour,
  formatTimeRounded,
  type Units,
} from "@/lib/format";
import { spinePath, type TimelineRow } from "@/lib/timeline/timeline";

/**
 * The continuous timeline.
 *
 * One scroll from the next hour to the end of the week, with a temperature
 * spine drawn behind the rows. No tabs, no section headers, no mode to choose:
 * the hours simply stop being hourly (Decisions Log 65).
 *
 * Row height is fixed rather than measured. The spine is one SVG path spanning
 * the whole list, and computing it from a constant means the curve is correct on
 * first paint instead of after a layout pass, which is the difference between a
 * line that is there and a line that snaps into place.
 */

/** Must match --row-h below. The SVG geometry is computed from it. */
const ROW_H = 56;
/** Horizontal travel of the spine, in px. Narrow on purpose: it is a hint. */
const SPINE_W = 44;

type Props = {
  rows: TimelineRow[];
  timeZone: string;
  units: Units;
  now: number;
  /** The row the scrubber is on, highlighted and announced. */
  activeIndex: number;
  onSelect: (index: number) => void;
};

function TimelineImpl({
  rows,
  timeZone,
  units,
  now,
  activeIndex,
  onSelect,
}: Props) {
  if (rows.length === 0) return null;

  const height = rows.length * ROW_H;

  return (
    <section
      className="relative"
      aria-label="Forecast timeline"
      style={{ "--row-h": `${ROW_H}px` } as React.CSSProperties}
    >
      {/*
        The spine sits behind the rows and is decorative: every value it encodes
        is also written as text in the row beside it, so it carries no
        information of its own and is hidden from assistive technology.
      */}
      <svg
        className="pointer-events-none absolute left-gutter top-0"
        width={SPINE_W}
        height={height}
        viewBox={`0 0 ${SPINE_W} ${height}`}
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ww-spine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--grad-2)" stopOpacity="0.9" />
            <stop offset="70%" stopColor="var(--grad-1)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--grad-1)" stopOpacity="0.15" />
          </linearGradient>
        </defs>

        <path
          d={spinePath(rows, SPINE_W, ROW_H)}
          stroke="url(#ww-spine)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {rows.map((row, index) => (
          <circle
            key={row.key}
            cx={row.spine * SPINE_W}
            cy={index * ROW_H + ROW_H / 2}
            r={index === activeIndex ? 3.5 : 1.75}
            fill={index === activeIndex ? "var(--accent)" : "var(--grad-2)"}
            className="ww-spine-dot"
          />
        ))}
      </svg>

      <ol className="relative">
        {rows.map((row, index) => (
          <TimelineRowView
            key={row.key}
            row={row}
            index={index}
            active={index === activeIndex}
            timeZone={timeZone}
            units={units}
            now={now}
            onSelect={onSelect}
          />
        ))}
      </ol>
    </section>
  );
}

export const Timeline = memo(TimelineImpl);

function TimelineRowView({
  row,
  index,
  active,
  timeZone,
  units,
  now,
  onSelect,
}: {
  row: TimelineRow;
  index: number;
  active: boolean;
  timeZone: string;
  units: Units;
  now: number;
  onSelect: (index: number) => void;
}) {
  return (
    <li
      className="ww-row relative flex items-center gap-3 pr-gutter"
      data-active={active || undefined}
      style={{
        height: `${ROW_H}px`,
        // The spine occupies the left gutter, so rows start clear of it.
        paddingLeft: `calc(var(--gutter) + ${SPINE_W}px + var(--space-3))`,
      }}
    >
      {/*
        The precipitation bar, behind the row rather than beside it, so a wet
        stretch reads as a block of weather at a glance instead of a column of
        numbers to compare. Scaled by intensity, not probability: chance of rain
        says nothing about how much.
      */}
      {row.kind !== "sun" && row.wet > 0 && (
        <span
          className="ww-wet pointer-events-none absolute inset-y-1 left-0 -z-10 rounded-r-[4px]"
          style={{ width: `calc(${row.wet} * 100%)` }}
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        onClick={() => onSelect(index)}
        className="flex flex-1 items-center gap-3 text-left"
      >
        {row.kind === "sun" ? (
          <SunRow row={row} timeZone={timeZone} />
        ) : row.kind === "hour" ? (
          <HourRow row={row} timeZone={timeZone} units={units} now={now} />
        ) : (
          <DayRow row={row} timeZone={timeZone} units={units} now={now} />
        )}
      </button>
    </li>
  );
}

function HourRow({
  row,
  timeZone,
  units,
  now,
}: {
  row: Extract<TimelineRow, { kind: "hour" }>;
  timeZone: string;
  units: Units;
  now: number;
}) {
  // The first row in the list is the hour we are in, and saying "Now" is more
  // use than repeating a clock time the phone already shows.
  const isNow = Math.abs(row.time - now) < 30 * 60_000;

  return (
    <>
      <span className="type-label w-12 shrink-0 text-2xs tabular-nums">
        {isNow ? "Now" : formatHour(row.time, timeZone)}
      </span>

      <WeatherIcon condition={row.condition} size={26} className="shrink-0" />

      <span className="flex-1 truncate text-xs text-text-dim">
        {row.condition.label}
      </span>

      {row.precipitationChance >= 25 && (
        <span className="type-label shrink-0 text-2xs tabular-nums text-text-faint">
          {Math.round(row.precipitationChance)}%
        </span>
      )}

      <span className="w-12 shrink-0 text-right text-md tabular-nums">
        <Temperature celsius={row.temperature} units={units} />
      </span>
    </>
  );
}

function DayRow({
  row,
  timeZone,
  units,
  now,
}: {
  row: Extract<TimelineRow, { kind: "day" }>;
  timeZone: string;
  units: Units;
  now: number;
}) {
  return (
    <>
      <span className="type-label w-12 shrink-0 truncate text-2xs">
        {formatDayName(row.time, timeZone, now).slice(0, 3)}
      </span>

      <WeatherIcon condition={row.condition} size={26} className="shrink-0" />

      <span className="flex-1 truncate text-xs text-text-dim">
        {row.condition.label}
      </span>

      {row.precipitationChance >= 25 && (
        <span className="type-label shrink-0 text-2xs tabular-nums text-text-faint">
          {Math.round(row.precipitationChance)}%
        </span>
      )}

      {/* High and low together, since a day has no single temperature. */}
      <span className="w-14 shrink-0 text-right text-md tabular-nums">
        <Temperature celsius={row.high} units={units} />
        <span className="ml-1 text-xs text-text-faint">
          <Temperature celsius={row.low} units={units} />
        </span>
      </span>
    </>
  );
}

/**
 * Sunrise and sunset are the only rows with their own colour, and it is amber
 * rather than the condition accent. They are events on the timeline, not
 * weather, and colouring them with the sky would make them read as more of the
 * same.
 */
function SunRow({
  row,
  timeZone,
}: {
  row: Extract<TimelineRow, { kind: "sun" }>;
  timeZone: string;
}) {
  return (
    <>
      {/* The hour alone said "8PM" for a sunset at 8:41, which is the one row
          on the timeline where the minutes are the point. Rounded to ten, to
          match the card and because the exact minute is false precision. */}
      <span className="w-12 shrink-0 text-2xs tabular-nums text-[color:var(--sun)]">
        {formatTimeRounded(row.time, timeZone).replace(/\s?([ap])\.?m\.?/i, "$1m")}
      </span>

      <span
        className="ww-sun-mark shrink-0"
        aria-hidden="true"
        data-event={row.event}
      />

      <span className="flex-1 text-xs text-[color:var(--sun)]">
        {row.event === "sunrise" ? "Sunrise" : "Sunset"}
      </span>
    </>
  );
}
