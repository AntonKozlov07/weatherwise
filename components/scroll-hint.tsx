"use client";

import { useEffect, useState, type RefObject } from "react";

type Props = {
  /** The element that scrolls. */
  targetRef: RefObject<HTMLElement | null>;
  direction: "horizontal" | "vertical";
  label: string;
};

/**
 * A chevron that says "there is more this way", and gets out of the way.
 *
 * Shown only when the target actually overflows, hidden the moment the user
 * scrolls it, and not shown again for the life of that element. A hint that
 * keeps returning stops being a hint and starts being clutter.
 */
export function ScrollHint({ targetRef, direction, label }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = targetRef.current;
    if (!node) return;

    const horizontal = direction === "horizontal";

    // Only a hint if there is genuinely something past the edge. The slack
    // avoids firing on a one or two pixel rounding difference.
    const overflows = () =>
      horizontal
        ? node.scrollWidth - node.clientWidth > 24
        : node.scrollHeight - node.clientHeight > 24;

    if (!overflows()) return;

    setVisible(true);

    const dismiss = () => {
      setVisible(false);
      node.removeEventListener("scroll", dismiss);
    };

    node.addEventListener("scroll", dismiss, { passive: true });

    // Content can arrive after mount, which changes whether it overflows.
    const observer = new ResizeObserver(() => {
      if (!overflows()) setVisible(false);
    });
    observer.observe(node);

    return () => {
      node.removeEventListener("scroll", dismiss);
      observer.disconnect();
    };
  }, [targetRef, direction]);

  if (!visible) return null;

  const horizontal = direction === "horizontal";

  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute z-30 flex h-7 w-7 items-center justify-center rounded-pill bg-surface-raised/80 text-text-dim backdrop-blur transition-opacity duration-200 ${
        horizontal
          ? "right-2 top-1/2 -translate-y-1/2"
          : "bottom-3 left-1/2 -translate-x-1/2"
      }`}
      title={label}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={horizontal ? "ww-nudge-x" : "ww-nudge-y"}
      >
        {horizontal ? <path d="m9 5 7 7-7 7" /> : <path d="m5 9 7 7 7-7" />}
      </svg>
    </span>
  );
}
