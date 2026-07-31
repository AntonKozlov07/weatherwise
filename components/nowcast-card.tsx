import { intensityOf } from "@/lib/weather/nowcast";
import type { Nowcast } from "@/lib/weather/types";

/**
 * Minute-by-minute precipitation for the next hour.
 *
 * Drawn as plain divs rather than a charting library: sixty bars and three
 * labels do not justify a dependency, and this way every colour and radius
 * comes from the tokens.
 *
 * Intensity is encoded as height and opacity together, so a drizzle and a
 * downpour are distinguishable rather than both reading as "wet".
 *
 * Renders nothing at all when One Call has no minutely data for the region.
 */

/** Under 90px total, including labels. */
const CHART_HEIGHT = "3.25rem";

export function NowcastCard({ nowcast }: { nowcast: Nowcast | null }) {
  if (!nowcast) return null;

  const { headline, points, hasPrecipitation } = nowcast;

  return (
    <section aria-label="Next hour" className="card mx-gutter p-5">
      <p className="type-label text-2xs">Next hour</p>
      <p className="mt-2 text-md leading-snug">{headline}</p>

      {/* A flat line of zeroes says nothing the headline has not. */}
      {hasPrecipitation && (
        <>
          <div
            className="mt-4 flex items-end gap-px"
            style={{ height: CHART_HEIGHT }}
            role="img"
            aria-label={`Precipitation for the next ${points.length} minutes`}
          >
            {points.map((point) => {
              const intensity = intensityOf(point.precipitation);

              return (
                <div
                  key={point.time}
                  className="flex-1 rounded-t-[2px]"
                  style={{
                    // A floor of 2% keeps a dry minute as a visible baseline
                    // rather than a gap, so the row reads as a continuous hour.
                    height: `${Math.max(2, intensity * 100)}%`,
                    backgroundColor:
                      intensity === 0
                        ? "var(--border)"
                        : `color-mix(in oklab, var(--accent) ${
                            40 + intensity * 60
                          }%, transparent)`,
                  }}
                />
              );
            })}
          </div>

          {/* Minute offsets, not clock times: a 60 minute span usually falls
              inside one or two clock hours, so hour labels read "2pm, 2pm". */}
          <div className="mt-2 flex justify-between">
            <span className="type-label text-2xs">Now</span>
            <span className="type-label text-2xs">
              +{Math.round(points.length / 2)} min
            </span>
            <span className="type-label text-2xs">+{points.length - 1} min</span>
          </div>
        </>
      )}
    </section>
  );
}
