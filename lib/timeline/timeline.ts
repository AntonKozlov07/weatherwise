import type {
  Astronomy,
  DailyPoint,
  HourlyPoint,
  ConditionRef,
} from "@/lib/weather/types";

/**
 * The continuous timeline.
 *
 * One list, from the next hour out to the end of the daily forecast, with no
 * section break between them. The old build split this into an Hourly tab and a
 * Weekly tab behind a segmented control, which forced a decision before showing
 * anything and hid the thing people actually want to see: where the hours stop
 * mattering and the days take over (Decisions Log 65).
 *
 * Hours run while they exist, days pick up after the last hour, and sun events
 * are threaded in at their real positions. Nothing labels the change, because
 * there is nothing to decide.
 *
 * Pure: rows and spine geometry are computed here and rendered by the component,
 * so the shape of the graph can be tested without a DOM.
 */

export type TimelineRow =
  | {
      kind: "hour";
      key: string;
      time: number;
      condition: ConditionRef;
      temperature: number;
      precipitation: number;
      precipitationChance: number;
      /** Position on the temperature spine, 0 coldest to 1 warmest. */
      spine: number;
      /** Precipitation bar width, 0 to 1, already eased for visibility. */
      wet: number;
    }
  | {
      kind: "sun";
      key: string;
      time: number;
      event: "sunrise" | "sunset";
      spine: number;
    }
  | {
      kind: "day";
      key: string;
      time: number;
      condition: ConditionRef;
      high: number;
      low: number;
      precipitation: number;
      precipitationChance: number;
      spine: number;
      wet: number;
    };

/** Rain at or above this registers as a bar rather than nothing. */
const WET_FLOOR_MM = 0.1;

/**
 * Temperature range is padded so a flat day does not draw a straight line
 * pinned to one edge, and a spine that never moves reads as broken rather than
 * calm.
 */
const MIN_RANGE_C = 6;

function normalise(value: number, min: number, max: number): number {
  if (max - min < 0.001) return 0.5;
  return (value - min) / (max - min);
}

/**
 * Square-rooted because linear scaling makes drizzle invisible next to a
 * downpour, and drizzle is the case people most need to see (Decisions Log 60).
 */
function wetness(mm: number, peak: number): number {
  if (mm < WET_FLOOR_MM || peak <= 0) return 0;
  return Math.min(1, Math.sqrt(mm / peak));
}

export type TimelineInput = {
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  astronomy: Astronomy;
  /** Rows before this instant are dropped, so the list always starts at now. */
  now: number;
};

export function buildTimeline({
  hourly,
  daily,
  astronomy,
  now,
}: TimelineInput): TimelineRow[] {
  const hours = hourly.filter((hour) => hour.time >= now - 3_600_000);
  const lastHour = hours.length > 0 ? hours[hours.length - 1].time : now;

  // Days only take over where the hours run out, so nothing is stated twice.
  const days = daily.filter((day) => day.date > lastHour);

  const temperatures = [
    ...hours.map((hour) => hour.temperature),
    ...days.flatMap((day) => [day.high, day.low]),
  ];

  if (temperatures.length === 0) return [];

  let min = Math.min(...temperatures);
  let max = Math.max(...temperatures);

  if (max - min < MIN_RANGE_C) {
    const pad = (MIN_RANGE_C - (max - min)) / 2;
    min -= pad;
    max += pad;
  }

  const peak = Math.max(
    ...hours.map((hour) => hour.precipitation),
    ...days.map((day) => day.precipitation),
    0,
  );

  const hourRows: TimelineRow[] = hours.map((hour) => ({
    kind: "hour" as const,
    key: `h-${hour.time}`,
    time: hour.time,
    condition: hour.condition,
    temperature: hour.temperature,
    precipitation: hour.precipitation,
    precipitationChance: hour.precipitationChance,
    spine: normalise(hour.temperature, min, max),
    wet: wetness(hour.precipitation, peak),
  }));

  const rows: TimelineRow[] = [...hourRows];

  /**
   * Today's pair, from the astronomy block, for the stretch the hours cover.
   *
   * Only events still ahead: the timeline starts at now, and a sunrise that
   * already happened has no position on it. The card states both regardless,
   * which is where you look for one that has passed.
   */
  for (const event of ["sunrise", "sunset"] as const) {
    const time = astronomy[event];
    if (time === null || time < now || time > lastHour) continue;

    rows.push({
      kind: "sun",
      key: `s-${event}-${time}`,
      time,
      event,
      // Interpolated against the hours only, never against a sun row already
      // pushed, so sunset does not anchor itself to sunrise.
      spine: interpolatedSpine(hourRows, time),
    });
  }

  /**
   * Every later day's own pair, which the daily payload carries per day.
   *
   * An earlier version inferred nothing here and left days without sun rows, on
   * the belief that the daily records had no sun times. They do.
   */
  for (const day of days) {
    for (const event of ["sunrise", "sunset"] as const) {
      const time = day[event];

      // Guarded against the hourly window: today's pair is already placed
      // above, and OWM's first daily record is today.
      if (time === null || time <= lastHour) continue;

      rows.push({
        kind: "sun",
        key: `s-${event}-${time}`,
        time,
        event,
        // Days have no spine of their own between them, so the sun sits level
        // with the day it belongs to rather than interpolating across a gap of
        // twenty-odd hours.
        spine: normalise((day.high + day.low) / 2, min, max),
      });
    }

    rows.push({
      kind: "day",
      key: `d-${day.date}`,
      time: day.date,
      condition: day.condition,
      high: day.high,
      low: day.low,
      precipitation: day.precipitation,
      precipitationChance: day.precipitationChance,
      spine: normalise((day.high + day.low) / 2, min, max),
      wet: wetness(day.precipitation, peak),
    });
  }

  return rows.sort((a, b) => a.time - b.time);
}

/** Where the spine sits at an arbitrary instant, for threading sun events in. */
function interpolatedSpine(rows: TimelineRow[], time: number): number {
  const before = [...rows].reverse().find((row) => row.time <= time);
  const after = rows.find((row) => row.time >= time);

  if (!before) return after?.spine ?? 0.5;
  if (!after || after.time === before.time) return before.spine;

  const t = (time - before.time) / (after.time - before.time);

  return before.spine + (after.spine - before.spine) * t;
}

/**
 * The spine as an SVG path.
 *
 * Catmull-Rom style smoothing via mirrored control points: a polyline through
 * hourly temperatures is visibly faceted, and weather does not move in facets.
 * Kept here rather than in the component so the curve can be asserted on.
 */
export function spinePath(
  rows: TimelineRow[],
  width: number,
  rowHeight: number,
): string {
  if (rows.length === 0) return "";

  const points = rows.map((row, index) => ({
    x: row.spine * width,
    y: index * rowHeight + rowHeight / 2,
  }));

  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midY = (current.y + next.y) / 2;

    path += ` C ${current.x.toFixed(2)} ${midY.toFixed(2)}, ${next.x.toFixed(2)} ${midY.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }

  return path;
}

/** The row nearest an instant, for the scrubber to snap onto. */
export function rowIndexAt(rows: TimelineRow[], time: number): number {
  if (rows.length === 0) return -1;

  let best = 0;
  let bestGap = Infinity;

  rows.forEach((row, index) => {
    const gap = Math.abs(row.time - time);
    if (gap < bestGap) {
      bestGap = gap;
      best = index;
    }
  });

  return best;
}
