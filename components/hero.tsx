"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ShareButton } from "@/components/share-button";
import { Temperature } from "@/components/temperature";
import { WeatherFX, WindFX } from "@/components/weather-fx";
import { WeatherIcon } from "@/components/weather-icon";
import { topAnswers, type ActivityAnswer } from "@/lib/activities/activities";
import {
  formatDayName,
  formatHour,
  aqiSeverity,
  formatTemperature,
  formatTime,
  formatTimeRounded,
  formatWind,
  type Units,
} from "@/lib/format";
import { gradientMotion } from "@/lib/gradient-motion";
import { haptic } from "@/lib/haptics";
import { nextGoldenHour, uvPeak, type GoldenHour, type UvPeak } from "@/lib/sun/golden";
import { useCountUp } from "@/lib/hooks/use-count-up";
import type { Tilt } from "@/lib/hooks/use-tilt";
import { voiceLine } from "@/lib/voice/voice";
import type {
  AirQuality,
  Astronomy,
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
  /** For the share text only; the card itself shows the time, not the place. */
  locationName: string;
  timeZone: string;
  units: Units;
  /** Lifted to the screen so the greeting and the card lean together. */
  tilt: Tilt;
  /** True while the scrubber is away from now, which changes the time label. */
  scrubbed: boolean;
  airQuality: AirQuality | null;
  windGust: number;
  astronomy: Astronomy;
};

export function Hero({
  view,
  current,
  hourly,
  locationName,
  timeZone,
  units,
  tilt,
  scrubbed,
  airQuality,
  windGust,
  astronomy,
}: Props) {
  const [phase, setPhase] = useState<Phase>("closed");
  const [drag, setDrag] = useState(0);

  const heroRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelFocusRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const expanded = phase !== "closed";

  const close = useCallback(() => {
    setPhase((previous) => {
      if (previous === "closed") return previous;
      haptic("impact");
      return "closing";
    });
  }, []);

  const open = () => {
    if (phase !== "closed") return;
    haptic("impact");
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
    // The panel itself takes focus. There is no close button to focus: it sat
    // behind the temperature card and was unreachable, and the panel already
    // has three ways out (the card, the backdrop, a swipe, plus Escape).
    if (phase === "open") panelFocusRef.current?.focus();
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
            windGust={windGust}
            astronomy={astronomy}
            timeZone={timeZone}
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
            ref={(node) => {
              panelRef.current = node;
              panelFocusRef.current = node;
            }}
            tabIndex={-1}
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


            <ExpandedContent
              onDismiss={close}
              hourly={hourly}
              locationName={locationName}
              view={view}
              current={current}
              units={units}
              tilt={tilt}
              timeLabel={timeLabel}
              timeZone={timeZone}
              line={line}
              answers={answers}
              active={phase === "open"}
              airQuality={airQuality}
              windGust={windGust}
              astronomy={astronomy}
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
  windGust,
  astronomy,
  timeZone,
}: {
  view: Props["view"];
  units: Units;
  tilt: Tilt;
  timeLabel: string;
  line: string;
  windGust: number;
  astronomy: Astronomy;
  timeZone: string;
}) {
  const motion = gradientMotion(tilt);

  return (
    <div
      className={`ww-hero-band relative overflow-hidden rounded-card p-5 ${motion.className}`}
      data-tilt={motion.dataTilt}
      style={motion.style}
    >
      <WeatherFX condition={view.condition} />
      <WindFX gustKph={windGust} />
      <Glint tilt={tilt} />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="type-label truncate text-2xs text-[color:var(--on-band-dim)]">
            {timeLabel}
          </p>
          <p className="type-temp mt-1 text-[3.25rem]">
            <Temperature celsius={view.temperature} units={units} withUnit />
          </p>
          <p className="mt-1 truncate text-sm text-[color:var(--on-band-dim)]">
            {view.condition.label} · feels{" "}
            <Temperature celsius={view.feelsLike} units={units} />
          </p>
        </div>

        <WeatherIcon condition={view.condition} size={72} className="shrink-0" />
      </div>

      {/* The voice line rides in the collapsed state too, clamped to one line.
          It is the most useful thing on the screen and hiding it behind a tap
          would waste it. */}
      <p className="relative mt-3 line-clamp-1 text-xs text-[color:var(--on-band-dim)]">
        {line}
      </p>

      <SunTimes astronomy={astronomy} timeZone={timeZone} />
    </div>
  );
}

/**
 * Sunrise and sunset, always shown.
 *
 * The timeline only carries a sun row while the event is still ahead, so from
 * mid-morning the day looks like it never had a sunrise. Here both are stated
 * outright, whichever side of them you are on.
 *
 * Rounded to ten minutes, because sunset to the minute is false precision: it
 * moves with your horizon and it is never the number anyone acts on
 * (Decisions Log 72).
 */
function SunTimes({
  astronomy,
  timeZone,
}: {
  astronomy: Astronomy;
  timeZone: string;
}) {
  if (astronomy.sunrise === null && astronomy.sunset === null) return null;

  return (
    <p className="type-label relative mt-3 flex items-center gap-4 text-2xs text-[color:var(--on-band-dim)]">
      {astronomy.sunrise !== null && (
        <span className="flex items-center gap-1.5">
          <SunArrow direction="up" />
          {formatTimeRounded(astronomy.sunrise, timeZone)}
        </span>
      )}
      {astronomy.sunset !== null && (
        <span className="flex items-center gap-1.5">
          <SunArrow direction="down" />
          {formatTimeRounded(astronomy.sunset, timeZone)}
        </span>
      )}
    </p>
  );
}

function SunArrow({ direction }: { direction: "up" | "down" }) {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      aria-hidden="true"
      fill="none"
      className="shrink-0 text-[color:var(--sun)]"
    >
      <path
        d={direction === "up" ? "M5 9V1M2 4l3-3 3 3" : "M5 1v8M2 6l3 3 3-3"}
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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
function Glint({ tilt }: { tilt: Tilt }) {
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
  hourly,
  locationName,
  airQuality,
  windGust,
  astronomy,
  onDismiss,
}: {
  view: Props["view"];
  current: CurrentConditions;
  units: Units;
  tilt: Tilt;
  timeLabel: string;
  timeZone: string;
  line: string;
  answers: ActivityAnswer[];
  active: boolean;
  hourly: HourlyPoint[];
  locationName: string;
  airQuality: AirQuality | null;
  windGust: number;
  astronomy: Astronomy;
  onDismiss: () => void;
}) {
  const expandedMotion = gradientMotion(tilt);
  const golden = nextGoldenHour(astronomy, current.observedAt);
  const uv = uvPeak(hourly, current.observedAt);

  return (
    <div className="ww-hero-body">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Close"
        className={`ww-hero-band ww-hero-tap relative block w-full overflow-hidden rounded-card p-5 text-left ${expandedMotion.className}`}
        data-tilt={expandedMotion.dataTilt}
        style={expandedMotion.style}
      >
        <WeatherFX condition={view.condition} />
        <WindFX gustKph={windGust} />
        <Glint tilt={tilt} />

        <div className="relative flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="type-label truncate text-2xs text-[color:var(--on-band-dim)]">
              {timeLabel}
            </p>
            <p className="type-temp mt-1 text-[3.75rem]">
              <Temperature celsius={view.temperature} units={units} withUnit />
            </p>
            <p className="mt-1 text-sm text-[color:var(--on-band-dim)]">
              {view.condition.label}
            </p>
          </div>

          <WeatherIcon condition={view.condition} size={84} className="shrink-0" />
        </div>
      </button>

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

      <SunLines golden={golden} uv={uv} timeZone={timeZone} index={answers.length + 1} />

      <dl className="mt-5 grid grid-cols-3 gap-2">
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

        {/*
          Air quality is a category, not a quantity, so it does not count up:
          watching "Good" tick upward from nothing would be nonsense. Absent
          entirely where the pollution endpoint returned nothing, rather than
          showing a dash that looks like a reading of zero.
        */}
        {airQuality && (
          <div
            className="ww-stagger rounded-inner bg-surface px-2 py-3 text-center"
            style={{ "--i": answers.length + 5 } as React.CSSProperties}
          >
            <dd className="text-sm">{aqiSeverity(airQuality.index)}</dd>
            <dt className="type-label mt-1 text-2xs">Air</dt>
          </div>
        )}

        <div
          className="ww-stagger rounded-inner bg-surface px-2 py-3 text-center"
          style={{ "--i": answers.length + 6 } as React.CSSProperties}
        >
          <dd className="text-sm tabular-nums">
            {astronomy.sunset === null
              ? "--"
              : formatTimeRounded(astronomy.sunset, timeZone).replace(/\s?[ap]\.?m\.?/i, "")}
          </dd>
          <dt className="type-label mt-1 text-2xs">Sunset</dt>
        </div>
      </dl>

      <ShareButton
        current={current}
        locationName={locationName}
        units={units}
        line={line}
        index={answers.length + 7}
      />

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

/**
 * Light and sun strength.
 *
 * Golden hour is a real interval, not a synonym for evening, and it is only
 * shown while it is still ahead or happening.
 *
 * The UV line states when the sun is strongest and how strong. It deliberately
 * stops there: what to do about it is the reader's business, and a weather app
 * is in no position to tell anyone how long to spend in the sun
 * (Decisions Log 79).
 */
function SunLines({
  golden,
  uv,
  timeZone,
  index,
}: {
  golden: GoldenHour | null;
  uv: UvPeak | null;
  timeZone: string;
  index: number;
}) {
  if (!golden && !uv) return null;

  return (
    <ul
      className="ww-stagger mt-4 flex flex-col gap-1.5"
      style={{ "--i": index } as React.CSSProperties}
    >
      {golden && (
        <li className="flex items-center gap-2 text-xs text-text-dim">
          <span className="ww-verdict" style={{ background: "var(--sun)" }} />
          {golden.active ? (
            <span>
              Golden hour now, until {formatTimeRounded(golden.end, timeZone)}
            </span>
          ) : (
            <span>
              Golden hour {formatTimeRounded(golden.start, timeZone)} to{" "}
              {formatTimeRounded(golden.end, timeZone)}
            </span>
          )}
        </li>
      )}

      {uv && (
        <li className="flex items-center gap-2 text-xs text-text-dim">
          <span className="ww-verdict" style={{ background: "var(--alert-advisory)" }} />
          <span>
            {uv.past ? "UV peaked at" : "UV peaks at"} {uv.index}, {uv.band}
            {uv.past ? " " : " around "}
            {formatTimeRounded(uv.time, timeZone)}
          </span>
        </li>
      )}
    </ul>
  );
}
