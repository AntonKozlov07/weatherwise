"use client";

import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

/**
 * Counts a number up from zero when it first appears.
 *
 * Only used in the expanded hero, where the metrics arrive after the panel has
 * opened and the movement gives them somewhere to arrive from. Numbers that
 * count up on every render would be noise; this runs once per activation.
 *
 * The target is returned directly whenever the animation is not running, rather
 * than being written into state, so nothing depends on an effect having fired
 * and there is never a frame showing zero.
 */
export function useCountUp(target: number, active: boolean, duration = 650) {
  const [value, setValue] = useState(0);
  const frame = useRef(0);
  const reduced = useReducedMotion();
  const animating = active && !reduced;

  useEffect(() => {
    if (!animating) return;

    const start = performance.now();

    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / duration);
      // Ease-out cubic: fast off the mark, settling rather than stopping.
      const eased = 1 - Math.pow(1 - progress, 3);

      setValue(target * eased);

      if (progress < 1) frame.current = requestAnimationFrame(tick);
    };

    frame.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frame.current);
  }, [target, animating, duration]);

  return animating ? value : target;
}
