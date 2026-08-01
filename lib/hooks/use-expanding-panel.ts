"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A card that expands in place into an overlay.
 *
 * Extracted from the hero so the world cards can open the same way rather than
 * carrying a second copy. That matters more than the usual case against
 * duplication: this animation has two non-obvious failure modes, both found on
 * a device rather than by reading, and a second implementation would have
 * quietly missed them (Decisions Log 106).
 *
 *   1. The release must not depend on `requestAnimationFrame` alone. A
 *      backgrounded or throttled page never runs frames, and the panel freezes
 *      at the collapsed size with no way out. The timer is the guarantee; the
 *      frame is the polish.
 *
 *   2. The overlay has to be portalled to the body. `fixed` resolves against
 *      the nearest ancestor carrying a transform, and the route transition
 *      wrapper has one, so rendered in place the backdrop sizes itself to the
 *      card instead of the screen.
 *
 * The caller owns the markup. This owns the state machine, the FLIP, focus,
 * Escape, the scroll lock and the drag to dismiss.
 */

export type Phase = "closed" | "opening" | "open" | "closing";

/** Past this much drag, releasing dismisses rather than springs back. */
const DISMISS_PX = 110;

export function useExpandingPanel() {
  const [phase, setPhase] = useState<Phase>("closed");
  const [drag, setDrag] = useState(0);

  /** The collapsed card, which the panel animates out of and back into. */
  const sourceRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const expanded = phase !== "closed";

  const close = useCallback(() => {
    setPhase((previous) => (previous === "closed" ? previous : "closing"));
  }, []);

  const open = useCallback(() => {
    setPhase((previous) => {
      if (previous !== "closed") return previous;

      openerRef.current = document.activeElement as HTMLElement | null;
      return "opening";
    });
    // Reset here rather than on close: while closed the panel is unmounted, so
    // the only moment the value matters is the one before it appears again.
    setDrag(0);
  }, []);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const source = sourceRef.current;

    if (!panel || !source) return;
    if (phase !== "opening" && phase !== "closing") return;

    const from = source.getBoundingClientRect();
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
      const fallback = window.setTimeout(release, 120);

      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(fallback);
      };
    }

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

  // Focus moves into the panel on open and back to the card on close, so the
  // expansion is navigable rather than a trap that swallows the cursor.
  useEffect(() => {
    if (phase === "open") panelRef.current?.focus();
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

  /** Spread onto the panel element. Handles the swipe-down dismiss. */
  const dragHandlers = {
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => {
      // Only a drag that starts on the panel body counts; a drag from a button
      // is a mis-tap, not a dismiss.
      if ((event.target as HTMLElement).closest("button")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.dataset.dragStart = String(event.clientY);
    },
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => {
      const start = event.currentTarget.dataset.dragStart;
      if (start === undefined) return;
      // Downward only. Dragging up should do nothing at all.
      setDrag(Math.max(0, event.clientY - Number(start)));
    },
    onPointerUp: (event: React.PointerEvent<HTMLDivElement>) => {
      delete event.currentTarget.dataset.dragStart;
      if (drag > DISMISS_PX) close();
      else setDrag(0);
    },
    onPointerCancel: (event: React.PointerEvent<HTMLDivElement>) => {
      delete event.currentTarget.dataset.dragStart;
      setDrag(0);
    },
  };

  /** Applied to the panel so a drag follows the finger without transitioning. */
  const dragStyle =
    drag > 0
      ? { transform: `translateY(${drag}px)`, transition: "none" }
      : undefined;

  return { phase, expanded, open, close, sourceRef, panelRef, dragHandlers, dragStyle };
}
