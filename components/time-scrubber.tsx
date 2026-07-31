"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatDayName, formatHour } from "@/lib/format";
import { haptic } from "@/lib/haptics";

/**
 * The time scrubber.
 *
 * Drag along the bar to move the whole hero through the next 48 hours: the
 * temperature, the condition, the gradient and the glint all follow. It is one
 * gesture over a continuous range rather than a list of hours to tap, because
 * the question people actually have is "what does this evening look like", and
 * answering it by tapping through twelve cards is not answering it.
 *
 * It returns to now on its own. A scrubber left parked at 9pm turns a live
 * weather app into a stale one, and nobody remembers they moved it (Decisions
 * Log 66).
 */

/** How long after the last touch before the hero drifts back to now. */
const RETURN_AFTER_MS = 4500;

type Props = {
  /** Instants the scrubber can land on, ascending. */
  times: number[];
  timeZone: string;
  index: number;
  /**
   * Accepts an updater as well as a value. Key autorepeat can deliver several
   * presses inside one React batch, and a handler that computes from the
   * `index` prop reads the same stale value every time, so holding the key
   * moves one step instead of ten.
   */
  onChange: (index: number | ((previous: number) => number)) => void;
  /** Index of the current hour, which is where it returns to. */
  nowIndex: number;
};

export function TimeScrubber({
  times,
  timeZone,
  index,
  onChange,
  nowIndex,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const count = times.length;
  const fraction = count > 1 ? index / (count - 1) : 0;

  // Held in a ref so the auto-return effect does not restart every render when
  // the parent passes a new closure.
  const onChangeRef =
    useRef<(index: number | ((previous: number) => number)) => void>(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  /**
   * Drift back to now once the user stops. Not while dragging, and not when it
   * is already there, so the timer is not rescheduled on every move.
   */
  useEffect(() => {
    if (dragging || index === nowIndex) return;

    const timer = window.setTimeout(() => {
      onChangeRef.current(nowIndex);
    }, RETURN_AFTER_MS);

    return () => window.clearTimeout(timer);
  }, [dragging, index, nowIndex]);

  /**
   * One tick per hour crossed, not per pointer event. A move fires many times a
   * second and buzzing on each of them is not feedback, it is a rattle.
   */
  const moveTo = useCallback(
    (next: number) => {
      if (next !== index) haptic("select");
      onChange(next);
    },
    [index, onChange],
  );

  const indexFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || count === 0) return 0;

      const rect = track.getBoundingClientRect();
      const ratio = (clientX - rect.left) / rect.width;

      return Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1))));
    },
    [count],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    moveTo(indexFromClientX(event.clientX));
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    moveTo(indexFromClientX(event.clientX));
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : event.key === "Home"
            ? -count
            : event.key === "End"
              ? count
              : 0;

    if (step === 0) return;

    event.preventDefault();
    haptic("select");
    onChange((previous) => Math.max(0, Math.min(count - 1, previous + step)));
  };

  if (count === 0) return null;

  const time = times[index];
  const atNow = index === nowIndex;

  const label = atNow
    ? "Now"
    : `${formatDayName(time, timeZone, times[nowIndex])} ${formatHour(time, timeZone)}`
        .replace("Today ", "")
        .trim();

  return (
    <div className="page-gutter select-none">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Forecast time"
        aria-valuemin={0}
        aria-valuemax={count - 1}
        aria-valuenow={index}
        aria-valuetext={
          atNow ? "Now" : new Date(time).toLocaleString("en-CA", { timeZone })
        }
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        // Generous hit area around a thin visual track: the bar is 4px, which
        // is right to look at and far too small to grab.
        className="ww-scrub-track relative -mx-1 cursor-grab touch-none py-3"
        data-dragging={dragging || undefined}
      >
        <div className="ww-scrub-rail relative h-1 w-full rounded-pill">
          <div
            className="ww-scrub-fill absolute inset-y-0 left-0 rounded-pill"
            style={{ width: `${fraction * 100}%` }}
          />
          <div
            className="ww-scrub-thumb absolute top-1/2"
            style={{ left: `${fraction * 100}%` }}
          />
        </div>
      </div>

      {/* The label is the position, so the value is readable without inferring
          it from where the thumb sits. */}
      <p className="type-label mt-1 flex justify-between text-2xs">
        <span className={atNow ? "text-text-dim" : "text-[color:var(--accent)]"}>
          {label}
        </span>
        {!atNow && (
          <button
            type="button"
            onClick={() => {
              haptic("select");
              onChange(nowIndex);
            }}
            className="text-text-faint"
          >
            Back to now
          </button>
        )}
      </p>
    </div>
  );
}
