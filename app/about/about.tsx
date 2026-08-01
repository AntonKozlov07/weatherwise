"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { BottomNav } from "@/components/bottom-nav";

/**
 * About, privacy, and notices.
 *
 * Written from what the app actually does rather than adapted from a template.
 * A privacy policy that describes data collection this app does not perform is
 * worse than none: it is inaccurate about the one subject where accuracy is the
 * entire point (Decisions Log 87).
 *
 * One screen with disclosable sections rather than three routes, because these
 * are read once if ever, and three near-empty pages is three places for the
 * wording to drift apart.
 */

function Section({
  id,
  title,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  /**
   * The menu links straight to a section, so arriving at `#terms` has to open
   * Terms rather than land on a page of closed headings with no sign that the
   * thing asked for is one of them.
   *
   * Read once, in the initialiser, rather than written into state from an
   * effect: the hash is known before the first render and cannot change without
   * a navigation that remounts this anyway.
   */
  const [open, setOpen] = useState(
    () =>
      defaultOpen ||
      (typeof window !== "undefined" && window.location.hash === `#${id}`),
  );

  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [id]);

  return (
    <section id={id} className="scroll-mt-4 border-b border-border pb-4">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-4 py-2 text-left"
        >
          <span className="text-base">{title}</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden="true"
            className="shrink-0 transition-transform"
            style={{ transform: open ? "rotate(180deg)" : undefined }}
          >
            <path
              d="M2 4.5 6 8.5l4-4"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </h2>

      {open && (
        <div className="ww-fade flex flex-col gap-3 pt-1 text-sm leading-relaxed text-text-dim">
          {children}
        </div>
      )}
    </section>
  );
}

export function About() {
  return (
    <div className="screen">
      <main className="screen-scroll ww-rise page-gutter flex flex-col gap-6 pb-6 pt-2">
        <h1 className="screen-title">About</h1>

        <p className="text-sm leading-relaxed text-text-dim">
          WeatherWise is a personal weather app. It shows the forecast for
          places you choose, and nothing else.
        </p>

        <div className="flex flex-col gap-2">
          <Section id="privacy" title="Privacy" defaultOpen>
            <p>
              This app has no accounts, no analytics, and no advertising. There
              is no tracking of any kind, and nothing you do here is recorded
              for later.
            </p>
            <p>
              Your name, your saved locations, and your settings are stored on
              this device only, in the browser&rsquo;s own storage. They are
              never uploaded. Clearing the app&rsquo;s data, or using Reset in
              Settings, removes them permanently.
            </p>
            <p>
              Forecasts are fetched through this app&rsquo;s own server, which
              passes the coordinates of the place you are viewing to
              OpenWeatherMap in order to get the weather back. Those requests
              are not logged against you and are not associated with any
              identifier.
            </p>
            <p>
              If you turn on notifications, this app stores a push subscription
              for your device along with the coordinates of your location,
              rounded to about a kilometre, so it knows what weather to warn you
              about. That is the only thing kept on a server. Turning
              notifications off deletes it.
            </p>
            <p>
              Your device is never located automatically. Locations come from
              what you search for.
            </p>
          </Section>

          <Section id="sources" title="Where the data comes from">
            <p>
              Weather, air quality, and severe weather alerts come from
              OpenWeatherMap. Map tiles are from OpenWeatherMap and CARTO, built
              on OpenStreetMap data, &copy; OpenStreetMap contributors. Weather
              icons are Meteocons by Bas Milius, used under the MIT licence.
              Historical records and a second forecast, used to gauge
              confidence, come from Open-Meteo.
            </p>
            <p>
              Forecasts are estimates. Severe weather alerts are reproduced from
              the issuing authority and may be delayed or incomplete. Do not
              rely on this app alone in dangerous conditions; consult your
              national weather service.
            </p>
          </Section>

          <Section id="notifications" title="Notifications">
            <p>
              Alerts are checked every twenty minutes. Delivery depends on your
              device, your connection, and the push service, none of which this
              app controls, so a notification may arrive late or not at all.
            </p>
            <p>
              Custom alerts you create are evaluated against the same forecast
              data and are sent once when a condition begins, not repeatedly
              while it lasts.
            </p>
          </Section>

          <Section id="terms" title="Terms">
            <p>
              This app is provided as is, without warranty of any kind. It is a
              personal project, not a commercial service, and no guarantee is
              made about availability or accuracy.
            </p>
            <p>
              To the extent permitted by law, the author is not liable for any
              loss arising from use of this app or reliance on the information
              in it.
            </p>
          </Section>

          <Section id="licences" title="Open source and licences">
            <p>
              Built with Next.js and React, styled with Tailwind CSS, with maps
              rendered by MapLibre GL JS. Each is used under its own licence.
              Meteocons is MIT licensed. OpenStreetMap data is available under
              the Open Database Licence.
            </p>
          </Section>
        </div>

        <p className="text-2xs text-text-faint">
          Last updated 31 July 2026.{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
