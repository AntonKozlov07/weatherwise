"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/**
 * Launch animation: translucent clouds drift apart to reveal the wordmark.
 *
 * It overlays the app rather than gating it, so the home screen boots and
 * fetches underneath. By the time the clouds have parted, the app behind is
 * usually already loaded, which is why this reads as a brand moment rather than
 * a delay. Routing needs no help from here: the home screen already sends an
 * un-onboarded user to /onboarding, and that happens under the overlay.
 *
 * Once per app open, not per navigation. The overlay lives in the root layout,
 * which persists across internal navigation, and `sessionStorage` covers
 * reloads within the same session while still replaying on a cold launch.
 */

const SEEN_KEY = "weatherwise.splash-seen";
/** Clouds clear over 1900ms, then the overlay fades out over 400ms. */
const REVEAL_MS = 1900;
const FADE_MS = 400;

function Cloud({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 200 100"
      className={className}
      style={style}
      aria-hidden="true"
      fill="currentColor"
    >
      <ellipse cx="60" cy="62" rx="52" ry="30" />
      <ellipse cx="104" cy="46" rx="42" ry="34" />
      <ellipse cx="146" cy="64" rx="46" ry="28" />
    </svg>
  );
}

export function Splash() {
  // Starts hidden and is switched on after mount. Rendering it during SSR would
  // flash the overlay for everyone, including the navigations it should skip.
  const [phase, setPhase] = useState<"idle" | "playing" | "leaving" | "done">(
    "idle",
  );

  useEffect(() => {
    // React's lint rule warns about setting state synchronously in an effect,
    // and it is right in general. It is wrong here: this is a one-time mount
    // decision that has to resolve before the first paint. Deferring it to a
    // timer or a microtask would show a frame of the app before the curtain
    // drops, which is the exact thing the curtain exists to avoid.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (sessionStorage.getItem(SEEN_KEY)) {
      setPhase("done");
      return;
    }

    sessionStorage.setItem(SEEN_KEY, "1");

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      // No drifting clouds, but the brand moment still happens, briefly.
      setPhase("leaving");
      const timer = setTimeout(() => setPhase("done"), 400);
      return () => clearTimeout(timer);
    }

    setPhase("playing");

    const toLeaving = setTimeout(() => setPhase("leaving"), REVEAL_MS);
    const toDone = setTimeout(() => setPhase("done"), REVEAL_MS + FADE_MS);

    return () => {
      clearTimeout(toLeaving);
      clearTimeout(toDone);
    };
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  if (phase === "idle" || phase === "done") return null;

  const playing = phase === "playing";

  return (
    <div
      // `aria-hidden` because the app behind is the real content; a screen
      // reader should not announce a decorative curtain.
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-bg ${
        phase === "leaving" ? "ww-splash-out" : ""
      }`}
    >
      <div className="relative flex w-full items-center justify-center">
        <div className={playing ? "ww-logo-reveal" : ""}>
          <Image
            src="/brand/Special_Text_Version.svg"
            alt=""
            width={170}
            height={16}
            className="h-auto w-[min(17rem,68vw)]"
            priority
            unoptimized
          />
        </div>

        {playing && (
          <>
            <Cloud className="ww-cloud-left absolute w-[92vw] text-text" />
            <Cloud className="ww-cloud-right absolute w-[104vw] text-text-dim" />
          </>
        )}
      </div>
    </div>
  );
}
