"use client";

import { useState } from "react";

import { celsiusToFahrenheit, kphToMph, type Units } from "@/lib/format";
import {
  buildLeaderboard,
  formatRankValue,
  RANK_METRICS,
  TOP_N,
  type RankedCity,
  type RankMetric,
} from "@/lib/world/ranking";
import { HOME_CITY_ID, type WorldSnapshot } from "@/lib/world/world";

/**
 * Where your city stands.
 *
 * The grid of cards says what the weather is in each place. This says how yours
 * compares, which is the question the grid raises and never answers
 * (Decisions Log 113).
 *
 * Twelve places, then yours below the line if it did not make them. Truncating
 * at twelve and saying nothing more would leave the one city the reader
 * actually came for missing from a board about the world.
 */
export function Leaderboard({
  cities,
  units,
}: {
  cities: WorldSnapshot[];
  units: Units;
}) {
  const [metric, setMetric] = useState<RankMetric>("temperature");

  const board = buildLeaderboard(cities, metric, HOME_CITY_ID);

  if (board.top.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-1 flex gap-5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {RANK_METRICS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setMetric(option.id)}
            data-selected={metric === option.id || undefined}
            className="ww-tab type-label shrink-0 whitespace-nowrap px-1 pb-2 pt-1 text-2xs"
          >
            {option.label}
          </button>
        ))}
      </div>

      <ol className="flex flex-col">
        {board.top.map((entry) => (
          <Row key={entry.snapshot.id} entry={entry} metric={metric} units={units} />
        ))}
      </ol>

      {board.yours && (
        <>
          {/* Below the line, and labelled, so it reads as "and here is you"
              rather than as a thirteenth entry that lost its place. */}
          <p className="type-label text-2xs text-text-faint">
            {board.yours.rank} of {board.total}
          </p>
          <ol className="flex flex-col">
            <Row entry={board.yours} metric={metric} units={units} />
          </ol>
        </>
      )}
    </div>
  );
}

/**
 * Values are converted here rather than stored converted, matching the rest of
 * the app: everything is metric until the moment it is drawn.
 */
function displayValue(value: number, metric: RankMetric, units: Units): string {
  if (units === "metric") return formatRankValue(value, metric);

  if (metric === "temperature") {
    return formatRankValue(celsiusToFahrenheit(value), metric);
  }
  if (metric === "wind") return formatRankValue(kphToMph(value), metric);

  return formatRankValue(value, metric);
}

function unitFor(metric: RankMetric, units: Units): string {
  const base = RANK_METRICS.find((option) => option.id === metric)?.unit ?? "";

  if (units === "metric") return base;
  if (metric === "wind") return " mph";

  return base;
}

function Row({
  entry,
  metric,
  units,
}: {
  entry: RankedCity;
  metric: RankMetric;
  units: Units;
}) {
  const isHome = entry.snapshot.id === HOME_CITY_ID;

  return (
    <li className="ww-rank-row flex items-center gap-3 py-3" data-home={isHome || undefined}>
      <span className="type-label w-6 shrink-0 text-2xs tabular-nums">
        {entry.rank}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm">
        {entry.snapshot.name}
      </span>

      <span className="shrink-0 text-sm tabular-nums">
        {displayValue(entry.value, metric, units)}
        <span className="text-2xs text-text-dim">{unitFor(metric, units)}</span>
      </span>
    </li>
  );
}

export { TOP_N };
