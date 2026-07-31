"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { Temperature } from "@/components/temperature";
import { WeatherIcon } from "@/components/weather-icon";
import { topAnswers, type ActivityAnswer } from "@/lib/activities/activities";
import {
  formatDayName,
  formatHour,
  formatTemperature,
  formatTime,
  formatWind,
  type Units,
} from "@/lib/format";
import { useCountUp } from "@/lib/hooks/use-count-up";
import { useTilt } from "@/lib/hooks/use-tilt";
import { voiceLine } from "@/lib/voice/voice";
import type {
  ConditionRef,
  CurrentConditions,
  HourlyPoint,
} from "@/lib/weather/types";

/**
 * The hero.
 *
 * Collapsed it is the gradient band and the temperature. Tapped, it expands in
 * place into the full picture: what today is like in a sentence, what that
 * means for the things people actually do, and the numbers behind it.
 *
 * It expands rather than navigating because this is the same object with more
 * of itself showing, not a different screen. A push transition would say
 * otherwise, and the back gesture that comes with it is the wrong shape for
 * something you dismiss (Decisions Log 68).
 *
 * The expansion is a FLIP: the panel is laid out where it will end up, then
 * transformed back onto the collapsed hero's rectangle and released. Only
 * transform and opacity animate, so nothing lays out mid-flight.
 *
 * The overlay is portalled to the body rather than rendered in place. `fixed`
 * positioning is relative to the nearest ancestor carrying a transform, and the
 * hero sits inside the entrance animation's wrapper, which has one. Rendered in
 * place the backdrop sized itself to the hero instead of the viewport, putting
 * the panel a third of the way up the screen with nothing dimmed behind it.
 */

type Phase = "closed" | "opening" | "open" | "closing";

/** Past this much drag, releasing dismisses rather than springs back. */
const DISMISS_PX = 110;

type Props = {
  /** Conditions at the scrubbed time, which is `current` when parked at now. */
  view: {
    time: number;
    condition: ConditionRef;
    temperature: number;
    feelsLike: number;
    humidity: number;
    uvIndex: number;
    windSpeed: number;
  };
  current: CurrentConditions;
  hourly: HourlyPoint[];
  timeZone: string;
  units: Units;
  motionEffects: boolean;
  /** True while the scrubber is away from now, which changes the time label. */
  scrubbed: boolean;
};

export function Hero({
  view,
  current,
  hourly,
  timeZone,
  units,
  motionEffects,
  scrubbed,
}: Props) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [drag, setDrag] = useState(0);

  const heroRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const tilt = useTilt(motionEffects);
  const expanded = phase !== "closed";

  const close = useCallback(() => {
    setPhase((previous) => (previous === "closed" ? previous : "closing"));
  }, []);

  const open = () => {
    if (phase !== "closed") return;
    openerRef.current = document.activeElement as HTMLElement | null;
    // Reset here rather than on close: while closed the panel is unmounted, so
    // the only moment the value matters is the one before it appears again.
    setDrag(0);
    setPhase("opening");
  };

  /**
   * The FLIP. Runs before paint so the panel is never visible at its final
   * size: it is transformed onto the hero's rectangle first, then released on
   * the next frame.
   */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    const hero = heroRef.current;

    if (!panel || !hero) return;
    if (phase !== "opening" && phase !== "closing") return;

    const from = hero.getBoundingClientRect();
    const to = panel.getBoundingClientRect();

    if (to.width === 0 || to.height === 0) return;

    const transform = [
      `translate(${from.left - to.left}px, ${from.top - to.top}px)`,
      `scale(${from.width / to.width}, ${from.height / to.height})`,
    ].join(" ");

    if (phase === "opening") {
      panel.style.transition = "none";
      panel.style.transform = transform;
      panel.style.opacity = "0.6";

      const release = () => {
        panel.style.transition = "";
        panel.style.transform = "";
        panel.style.opacity = "";
        setPhase("open");
      };

      const frame = requestAnimationFrame(release);

      // A backgrounded or throttled page does not run animation frames, and a
      // panel released only by rAF stays frozen at the collapsed hero's size
      // with no way out. The timer is the guarantee; the frame is the polish.
      const fallback = window.setTimeout(release, 120);

      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(fallback);
      };
    }

    // Closing: back onto the hero, then unmount when the motion finishes.
    panel.style.transform = transform;
    panel.style.opacity = "0";

    const done = () => setPhase("closed");
    panel.addEventListener("transitionend", done, { once: true });

    // A transition that never fires, because the panel was hidden or motion is
    // reduced, must not leave the overlay stuck open.
    const fallback = window.setTimeout(done, 500);

    return () => {
      panel.removeEventListener("transitionend", done);
      window.clearTimeout(fallback);
    };
  }, [phase]);

  // Focus moves into the panel on open and back to the hero on close, so the
  // expansion is navigable rather than a trap that swallows the cursor.
  useEffect(() => {
    if (phase === "open") closeRef.current?.focus();
    if (phase === "closed") {
      openerRef.current?.focus();
      openerRef.current = null;
    }
  }, [phase]);

  useEffect(() => {
    if (!expanded) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };

    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while the panel is over it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [expanded, close]);

  const line = voiceLine({ current, hourly, timeZone });
  const answers = topAnswers(current, hourly, timeZone);

  // The location is already named directly above this, so repeating it here
  // would waste the one line that tells you which moment you are looking at.
  const timeLabel = scrubbed
    ? `${formatDayName(view.time, timeZone, current.observedAt)} ${formatHour(view.time, timeZone)}`.replace(
        "Today ",
        "",
      )
    : "Now";

  return (
    <>
      <div ref={heroRef} className="page-gutter">
        <button
          type="button"
          onClick={open}
          aria-expanded={expanded}
          className="ww-hero-tap block w-full text-left"
        >
          <HeroBand
            view={view}
            units={units}
            tilt={tilt}
            timeLabel={timeLabel}
            line={line}
          />
        </button>
      </div>

      {expanded && createPortal(
        <div
          className="ww-hero-backdrop fixed inset-0 z-50"
          data-phase={phase}
          // The backdrop is the dismiss target; the panel stops the event.
          onClick={close}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Conditions in detail"
            className="ww-hero-panel absolute inset-x-gutter"
            style={{
              transform: drag > 0 ? `translateY(${drag}px)` : undefined,
              transition: drag > 0 ? "none" : undefined,
            }}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => {
              // Only a drag that starts on the panel body counts; a drag from a
              // button is a mis-tap, not a dismiss.
              if ((event.target as HTMLElement).closest("button")) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              event.currentTarget.dataset.dragStart = String(event.clientY);
            }}
            onPointerMove={(event) => {
              const start = event.currentTarget.dataset.dragStart;
              if (start === undefined) return;
              // Downward only. Dragging up should do nothing at all.
              setDrag(Math.max(0, event.clientY - Number(start)));
            }}
            onPointerUp={(event) => {
              delete event.currentTarget.dataset.dragStart;
              if (drag > DISMISS_PX) close();
              else setDrag(0);
            }}
            onPointerCancel={(event) => {
              delete event.currentTarget.dataset.dragStart;
              setDrag(0);
            }}
          >
            <span className="ww-hero-grab" aria-hidden="true" />

            <button
              ref={closeRef}
              type="button"
              onClick={close}
              aria-label="Close"
              className="ww-hero-close absolute right-4 top-4"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <path
                  d="M1 1l12 12M13 1L1 13"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <ExpandedContent
              view={view}
              current={current}
              units={units}
              tilt={tilt}
              timeLabel={timeLabel}
              timeZone={timeZone}
              line={line}
              answers={answers}
              active={phase === "open"}
            />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

/**
 * The gradient band. This is the only saturated surface in the app: the
 * condition theme reaches here and nowhere else, which is what makes the colour
 * read as a signal rather than a wash (Decisions Log 64).
 */
function HeroBand({
  view,
  units,
  tilt,
  timeLabel,
  line,
}: {
  view: Props["view"];
  units: Units;
  tilt: { x: number; y: number };
  timeLabel: string;
  line: string;
}) {
  return (
    <div className="ww-hero-band relative overflow-hidden rounded-card p-5">
      <Glint tilt={tilt} />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="type-label truncate text-2xs">{timeLabel}</p>
          <p className="type-temp mt-1 text-[3.25rem]">
            <Temperature celsius={view.temperature} units={units} withUnit />
          </p>
          <p className="mt-1 truncate text-sm text-text-dim">
            {view.condition.label} · feels{" "}
            <Temperature celsius={view.feelsLike} units={units} />
          </p>
        </div>

        <WeatherIcon condition={view.condition} size={72} className="shrink-0" />
      </div>

      {/* The voice line rides in the collapsed state too, clamped to one line.
          It is the most useful thing on the screen and hiding it behind a tap
          would waste it. */}
      <p className="relative mt-3 line-clamp-1 text-xs text-text-dim">{line}</p>
    </div>
  );
}

/**
 * The highlight that follows tilt. Two layers moving by different amounts, so
 * it reads as depth rather than a sticker sliding around.
 *
 * Travel is capped at 15% of the band, well short of the edges: a highlight
 * that reaches the border stops looking like light and starts looking like a
 * shape.
 */
function Glint({ tilt }: { tilt: { x: number; y: number } }) {
  return (
    <>
      <span
        className="ww-glint"
        aria-hidden="true"
        style={{
          transform: `translate3d(${tilt.x * 15}%, ${tilt.y * 15}%, 0)`,
        }}
      />
      <span
        className="ww-glint ww-glint-far"
        aria-hidden="true"
        style={{
          transform: `translate3d(${tilt.x * -8}%, ${tilt.y * -8}%, 0)`,
        }}
      />
    </>
  );
}

function ExpandedContent({
  view,
  current,
  units,
  tilt,
  timeLabel,
  timeZone,
  line,
  answers,
  active,
}: {
  view: Props["view"];
  current: CurrentConditions;
  units: Units;
  tilt: { x: number; y: number };
  timeLabel: string;
  timeZone: string;
  line: string;
  answers: ActivityAnswer[];
  active: boolean;
}) {
  return (
    <div className="ww-hero-body">
      <div className="ww-hero-band relative overflow-hidden rounded-card p-5">
        <Glint tilt={tilt} />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="type-label truncate text-2xs">{timeLabel}</p>
            <p className="type-temp mt-1 text-[3.75rem]">
              <Temperature celsius={view.temperature} units={units} withUnit />
            </p>
            <p className="mt-1 text-sm text-text-dim">{view.condition.label}</p>
          </div>

          <WeatherIcon condition={view.condition} size={84} className="shrink-0" />
        </div>
      </div>

      {/*
        Staggered reveal. Each child declares its own index and the delay comes
        from that, so inserting a row does not mean rewriting a chain of
        hardcoded delays. Reversed on exit by the closing state.
      */}
      <p
        className="ww-stagger mt-4 text-base leading-snug"
        style={{ "--i": 0 } as React.CSSProperties}
      >
        {line}
      </p>

      <ul className="mt-4 space-y-2">
        {answers.map((answer, index) => (
          <li
            key={answer.id}
            className="ww-stagger flex items-center justify-between gap-3"
            style={{ "--i": index + 1 } as React.CSSProperties}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="ww-verdict" data-verdict={answer.verdict} />
              <span className="truncate text-xs text-text-dim">{answer.label}</span>
            </span>
            <span className="shrink-0 text-xs">{answer.answer}</span>
          </li>
        ))}
      </ul>

      <dl className="mt-5 grid grid-cols-4 gap-2">
        <Metric
          label="Feels"
          value={view.feelsLike}
          active={active}
          index={answers.length + 1}
          format={(value) => `${formatTemperature(value, units)}°`}
        />
        <Metric
          label="Humidity"
          value={view.humidity}
          active={active}
          index={answers.length + 2}
          format={(value) => `${Math.round(value)}%`}
        />
        <Metric
          label="Wind"
          value={view.windSpeed}
          active={active}
          index={answers.length + 3}
          format={(value) => formatWind(value, units)}
        />
        <Metric
          label="UV"
          value={view.uvIndex}
          active={active}
          index={answers.length + 4}
          format={(value) => String(Math.round(value))}
        />
      </dl>

      <p
        className="ww-stagger mt-4 text-2xs text-text-faint"
        style={{ "--i": answers.length + 5 } as React.CSSProperties}
      >
        Observed {formatTime(current.observedAt, timeZone)}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  active,
  index,
  format,
}: {
  label: string;
  value: number;
  active: boolean;
  index: number;
  format: (value: number) => string;
}) {
  const counted = useCountUp(value, active);

  return (
    <div
      className="ww-stagger rounded-inner bg-surface px-2 py-3 text-center"
      style={{ "--i": index } as React.CSSProperties}
    >
      <dd className="text-sm tabular-nums">{format(counted)}</dd>
      <dt className="type-label mt-1 text-2xs">{label}</dt>
    </div>
  );
}
