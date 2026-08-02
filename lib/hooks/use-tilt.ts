"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * Tilt-reactive highlight.
 *
 * Returns a normalised offset, -1 to 1 on each axis, that the hero's glint
 * follows. Two sources, in order of preference:
 *
 *   1. Device orientation, where the user has granted it.
 *   2. An ambient drift, a very slow figure-of-eight, everywhere else.
 *
 * The drift is not a fallback so much as the default: most users will never
 * grant motion access, and a highlight that sits dead still looks like a
 * gradient someone forgot to finish. It moves slowly enough that it reads as
 * light on a surface rather than as an animation (Decisions Log 67).
 *
 * Movement is smoothed toward the target rather than tracked directly. Raw
 * orientation readings are noisy enough that a glint bound straight to them
 * jitters while the phone sits on a table.
 */

/** Per frame, toward the target. Low enough to feel like weight. */
const LERP = 0.08;
/** Beyond this the phone is being waved, not tilted. */
const MAX_DEGREES = 35;

type Offset = { x: number; y: number };

/**
 * What consumers receive. `live` distinguishes a phone actually being tilted
 * from the ambient drift, which matters because the two drive the gradient in
 * different ways: one follows the hand, the other loops on its own.
 */
export type Tilt = { x: number; y: number; live: boolean };

type OrientationConstructor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

export function tiltSupported(): boolean {
  return typeof window !== "undefined" && "DeviceOrientationEvent" in window;
}

/**
 * Raises the iOS permission prompt. Must be called from a user gesture: iOS
 * silently rejects it otherwise, and a declined prompt cannot be raised again,
 * so this is only ever called from the Settings toggle.
 */
export async function requestTiltPermission(): Promise<boolean> {
  const constructor = window.DeviceOrientationEvent as
    | OrientationConstructor
    | undefined;

  if (typeof constructor?.requestPermission !== "function") return true;

  try {
    return (await constructor.requestPermission()) === "granted";
  } catch {
    return false;
  }
}

const STILL: Offset = { x: 0, y: 0 };

export function useTilt(enabled: boolean): Tilt {
  const [offset, setOffset] = useState<Offset>(STILL);
  const target = useRef<Offset>({ x: 0, y: 0 });
  const current = useRef<Offset>({ x: 0, y: 0 });
  const reduced = useReducedMotion();

  useEffect(() => {
    // Reduced motion means no motion, so it does not drift either. Returning
    // before the loop starts is the whole implementation: the hook hands back a
    // fixed zero below rather than writing one into state.
    if (typeof window === "undefined" || reduced) return;

    let frame = 0;
    let running = true;
    const started = performance.now();

    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;

      target.current = {
        x: Math.max(-1, Math.min(1, event.gamma / MAX_DEGREES)),
        // Offset by 45 degrees: a phone in the hand is held tilted back, and
        // measuring from flat would peg the highlight at one end.
        y: Math.max(-1, Math.min(1, (event.beta - 45) / MAX_DEGREES)),
      };
    };

    const useOrientation = enabled && tiltSupported();

    if (useOrientation) {
      window.addEventListener("deviceorientation", onOrientation);
    }

    const tick = (time: number) => {
      if (!running) return;

      if (!useOrientation) {
        // A slow Lissajous figure. The two periods are deliberately not
        // multiples of each other, so the path never visibly repeats.
        const t = (time - started) / 1000;
        target.current = {
          x: Math.sin(t / 7) * 0.6,
          y: Math.sin(t / 11) * 0.4,
        };
      }

      current.current = {
        x: current.current.x + (target.current.x - current.current.x) * LERP,
        y: current.current.y + (target.current.y - current.current.y) * LERP,
      };

      setOffset({ x: current.current.x, y: current.current.y });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);

    // A backgrounded tab should not be running an animation loop, and iOS keeps
    // delivering orientation events to a hidden page.
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        frame = requestAnimationFrame(tick);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisibility);
      if (useOrientation) {
        window.removeEventListener("deviceorientation", onOrientation);
      }
    };
  }, [enabled, reduced]);

  // Derived, not stored. Whether orientation is driving this is already known
  // from the inputs, and putting it in state would mean writing to state from
  // inside the effect that sets the loop up.
  return reduced
    ? { ...STILL, live: false }
    : { x: offset.x, y: offset.y, live: enabled };
}
