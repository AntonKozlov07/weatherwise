"use client";

import { conditionKeyFor } from "@/lib/theme/condition-theme";
import type { ConditionRef } from "@/lib/weather/types";

/**
 * Weather motion on the hero card.
 *
 * Rain, snow, wind and fog, and only here. Confined to the one card by request,
 * because ambient weather across a whole screen is a wallpaper and this is a
 * forecast: it has to stay a detail you notice rather than a thing you look at
 * (Decisions Log 71).
 *
 * CSS only, no canvas and no per-frame JavaScript. Particles are a fixed set of
 * absolutely positioned spans with staggered delays, which the compositor
 * handles on its own thread. A canvas here would mean a render loop running
 * whenever the app is open, for an effect measured in single-digit opacity.
 *
 * Every layer is `aria-hidden` and `pointer-events: none`. All of it stops dead
 * under reduced motion.
 */

/** Enough to read as weather, few enough to stay cheap. */
const RAIN_DROPS = 28;
const SNOW_FLAKES = 22;
const WIND_STREAKS = 7;

/**
 * Deterministic pseudo-random, seeded by index.
 *
 * Not `Math.random`: particle positions have to match between the server render
 * and the client hydration, or React replaces the whole layer and the animation
 * restarts on every load.
 */
function scatter(index: number, salt: number): number {
  const value = Math.sin((index + 1) * salt) * 10_000;
  return value - Math.floor(value);
}

export function WeatherFX({ condition }: { condition: ConditionRef }) {
  const kind = conditionKeyFor(condition.code);

  if (kind === "rain" || kind === "storm") {
    return (
      <span className="ww-fx" aria-hidden="true" data-fx="rain">
        {Array.from({ length: RAIN_DROPS }, (_, index) => (
          <span
            key={index}
            className="ww-drop"
            style={{
              left: `${scatter(index, 12.9898) * 100}%`,
              // Delays are spread across the full duration so the rain arrives
              // already falling rather than starting as one visible sheet.
              animationDelay: `${scatter(index, 78.233) * -1.1}s`,
              animationDuration: `${0.62 + scatter(index, 43.11) * 0.5}s`,
              opacity: 0.25 + scatter(index, 91.7) * 0.4,
            }}
          />
        ))}
      </span>
    );
  }

  if (kind === "snow") {
    return (
      <span className="ww-fx" aria-hidden="true" data-fx="snow">
        {Array.from({ length: SNOW_FLAKES }, (_, index) => (
          <span
            key={index}
            className="ww-flake"
            style={{
              left: `${scatter(index, 12.9898) * 100}%`,
              animationDelay: `${scatter(index, 78.233) * -9}s`,
              animationDuration: `${6.5 + scatter(index, 43.11) * 5}s`,
              // Varied size, or every flake reads as the same object repeated.
              width: `${2 + scatter(index, 27.3) * 2.5}px`,
              height: `${2 + scatter(index, 27.3) * 2.5}px`,
              opacity: 0.3 + scatter(index, 91.7) * 0.45,
            }}
          />
        ))}
      </span>
    );
  }

  if (kind === "fog") {
    // Three broad, very soft bands at different speeds. Fog has no particles to
    // draw; what reads as fog is depth passing at different rates.
    return (
      <span className="ww-fx" aria-hidden="true" data-fx="fog">
        <span className="ww-fog" style={{ animationDuration: "19s", top: "18%" }} />
        <span
          className="ww-fog"
          style={{ animationDuration: "27s", top: "46%", animationDelay: "-8s" }}
        />
        <span
          className="ww-fog"
          style={{ animationDuration: "23s", top: "70%", animationDelay: "-14s" }}
        />
      </span>
    );
  }

  return null;
}

/**
 * Wind, shown whenever it is strong enough to matter, whatever the sky is
 * doing. It layers over the others: rain in a gale is both.
 */
export function WindFX({ gustKph }: { gustKph: number }) {
  if (gustKph < 25) return null;

  // Stronger wind moves faster and shows more streaks, so the effect carries
  // information rather than being decoration that is always identical.
  const strength = Math.min(1, (gustKph - 25) / 45);
  const count = Math.round(3 + strength * (WIND_STREAKS - 3));

  return (
    <span className="ww-fx" aria-hidden="true" data-fx="wind">
      {Array.from({ length: count }, (_, index) => (
        <span
          key={index}
          className="ww-streak"
          style={{
            top: `${8 + scatter(index, 12.9898) * 80}%`,
            width: `${18 + scatter(index, 27.3) * 34}%`,
            animationDelay: `${scatter(index, 78.233) * -5}s`,
            animationDuration: `${2.6 - strength * 1.1 + scatter(index, 43.11) * 0.9}s`,
            opacity: 0.1 + strength * 0.22,
          }}
        />
      ))}
    </span>
  );
}
