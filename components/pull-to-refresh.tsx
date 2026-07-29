"use client";

import { useEffect, useRef, useState } from "react";

/** Drag distance that triggers a refresh. */
const THRESHOLD = 72;
/** Beyond the threshold the pull slows down, so it feels like it has a limit. */
const MAX_PULL = 120;
const RESISTANCE = 0.5;

type Props = {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
};

/**
 * Custom pull to refresh.
 *
 * `overscroll-behavior: none` on the document is required so an installed PWA
 * does not rubber-band, and it takes the native gesture with it. This puts it
 * back: the container translates under the finger and a spinner fades in past
 * the threshold.
 *
 * Only starts when the page is already scrolled to the top, otherwise a normal
 * upward scroll would fight the gesture.
 */
export function PullToRefresh({ onRefresh, children }: Props) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Rendered, because the release animation depends on it: the container eases
  // back only when the finger is gone, and follows it exactly while it is down.
  const [dragging, setDragging] = useState(false);
  const startY = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const atTop = () => window.scrollY <= 0;

    const onTouchStart = (event: TouchEvent) => {
      if (refreshing || !atTop()) return;
      startY.current = event.touches[0].clientY;
      setDragging(true);
    };

    const onTouchMove = (event: TouchEvent) => {
      if (startY.current === null || refreshing) return;

      const delta = event.touches[0].clientY - startY.current;

      // An upward drag is an ordinary scroll. Release the gesture entirely so
      // the page scrolls normally rather than being held at zero.
      if (delta <= 0) {
        startY.current = null;
        setDragging(false);
        setPull(0);
        return;
      }

      // Only claim the gesture once it is clearly a pull, so a slightly
      // off-vertical scroll still scrolls.
      if (delta > 8 && event.cancelable) event.preventDefault();

      setPull(Math.min(MAX_PULL, delta * RESISTANCE));
    };

    const onTouchEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      setDragging(false);

      if (pull < THRESHOLD) {
        setPull(0);
        return;
      }

      setRefreshing(true);
      setPull(THRESHOLD);

      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    };

    // Not passive: the move handler has to be able to preventDefault.
    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd);
    node.addEventListener("touchcancel", onTouchEnd);

    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [onRefresh, pull, refreshing]);

  const armed = pull >= THRESHOLD;

  return (
    <div ref={containerRef}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
        style={{
          height: pull,
          opacity: Math.min(1, pull / THRESHOLD),
        }}
        aria-hidden={!refreshing}
      >
        <div className="flex items-end pb-2">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            className={refreshing ? "ww-spin text-accent" : "text-text-dim"}
            style={{
              transform: refreshing ? undefined : `rotate(${pull * 3}deg)`,
              color: armed && !refreshing ? "var(--accent)" : undefined,
            }}
          >
            <path d="M20 12a8 8 0 1 1-2.34-5.66" />
            <path d="M20 4v4.5h-4.5" />
          </svg>
        </div>
      </div>

      <div
        style={{
          transform: `translate3d(0, ${pull}px, 0)`,
          transition: dragging
            ? undefined
            : "transform 260ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        {children}
      </div>

      <span role="status" aria-live="polite" className="sr-only">
        {refreshing ? "Refreshing forecast" : ""}
      </span>
    </div>
  );
}
