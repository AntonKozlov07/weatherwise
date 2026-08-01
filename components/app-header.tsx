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
      <header className="screen-header">
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

        {/* Centred on the screen, not on the space left of the hamburger: the
            button is absolutely positioned so it takes the wordmark out of the
            flow calculation entirely.
            The source viewBox carried 72 units of empty space to the right of
            the artwork, so a centred element still rendered the wordmark 15%
            left of centre. The viewBox is now cropped to the art, and these
            dimensions match its real aspect ratio (Decisions Log 48). */}
        <Image
          src="/brand/WeatherWise_Text_Logo.svg"
          alt="WeatherWise"
          width={160}
          height={15}
          // Capped in rem and floored in vw so it stays clear of the hamburger
          // on a narrower phone instead of crowding it.
          // Now that the viewBox is cropped, the element width is the artwork
          // width, so this floors lower than before to keep clear of the
          // hamburger on a 360px screen.
          className="h-auto w-[min(15rem,57vw)]"
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
            className="relative flex h-full w-72 max-w-[80%] flex-col overflow-y-auto bg-surface pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            {/*
              The text sits at the top of the drawer, and the drawer already
              starts below the status bar: its overlay is fixed, but a
              transformed ancestor makes that resolve against the shell's
              padded box rather than the display. So no inset is applied here.
              Adding one was what produced the band of empty surface in the
              first place, by counting the same inset twice.

              Two decorations were tried in that space and both were wrong: the
              logo alone was inert, and a gradient was noise competing with the
              two lines that matter. It was never a slot that needed filling
              (Decisions Log 93).
            */}
            <div className="px-6 pb-2 pt-5">
              <span className="type-wordmark text-2xs text-text-faint">
                WeatherWise
              </span>

              {locationName && (
                <p className="type-label mt-5 text-2xs">Showing</p>
              )}
              <p className="type-heading mt-1 text-xl">
                {locationName ?? "Weather, at a glance"}
              </p>
            </div>

            <div className="flex flex-1 flex-col gap-1 p-6 pt-5">

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="rounded-inner px-3 py-3 text-base hover:bg-surface-raised"
            >
              Settings
            </Link>
            {/*
              Small print, pushed to the foot of the drawer. It belongs in the
              menu rather than buried in Settings, which is where people look
              for it, and it sits apart from the navigation above because it is
              reference material rather than somewhere you go.
            */}
            <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
              {[
                { href: "/about#privacy", label: "Privacy" },
                { href: "/about#terms", label: "Terms" },
                { href: "/about#sources", label: "Data sources" },
                { href: "/about#licences", label: "Licences" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-inner px-3 py-2 text-sm text-text-dim hover:bg-surface-raised"
                >
                  {item.label}
                </Link>
              ))}

              <p className="px-3 pt-2 text-2xs text-text-faint">
                WeatherWise. Forecasts are estimates.
              </p>
            </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
