"use client";

/**
 * Route transition.
 *
 * A template, not a layout: Next remounts this on every navigation, which is
 * what restarts the animation. A layout would mount once and never replay.
 *
 * Kept at 220ms and to opacity plus a 6px lift, so it reads as the screen
 * arriving rather than as something to wait for. `prefers-reduced-motion`
 * removes it entirely via the global rule in globals.css.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="ww-route-in flex min-h-0 flex-1 flex-col">{children}</div>;
}
