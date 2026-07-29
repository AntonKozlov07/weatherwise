"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Header with the hamburger and the centred wordmark.
 *
 * The drawer holds the three entries CLAUDE.md specifies. What sits behind
 * Settings is phase 5; the route exists so the control is never dead.
 */
export function AppHeader({ locationName }: { locationName?: string }) {
  const [open, setOpen] = useState(false);

  // The drawer is the only thing on screen when it is open, so Escape has to
  // close it or a keyboard user is stuck.
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <header className="relative flex items-center justify-center px-5 pb-3 pt-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="ww-press absolute left-4 rounded-inner p-2"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        {/* Centred on the screen, not on the space left of the hamburger:
            the button is absolutely positioned so it takes the wordmark out of
            the flow calculation entirely. */}
        <Image
          src="/brand/WeatherWise_Text_Logo.svg"
          alt="WeatherWise"
          width={264}
          height={22}
          // Capped in rem and floored in vw so it stays clear of the hamburger
          // on a narrower phone instead of crowding it.
          className="h-auto w-[min(16.5rem,62vw)]"
          priority
          unoptimized
        />
      </header>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60"
          />

          <nav
            aria-label="Main menu"
            className="relative flex w-72 max-w-[80%] flex-col gap-1 bg-surface p-6 pt-[calc(1.5rem+env(safe-area-inset-top))]"
          >
            <p className="type-heading mb-4 text-lg">
              {locationName ?? "WeatherWise"}
            </p>

            <Link
              href="/guide"
              onClick={() => setOpen(false)}
              className="rounded-inner px-3 py-3 text-base hover:bg-surface-raised"
            >
              Guide
            </Link>
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="rounded-inner px-3 py-3 text-base hover:bg-surface-raised"
            >
              Settings
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
