"use client";

import { useEffect, useState } from "react";

import { formatTime } from "@/lib/format";
import {
  alertSeverity,
  compareBySeverity,
  type AlertSeverity,
} from "@/lib/weather/severity";
import type { WeatherAlert } from "@/lib/weather/types";

/**
 * Severe weather banner.
 *
 * Sits in the flow above everything else on Home and pushes content down rather
 * than overlaying it: a warning that covers the temperature is worse than one
 * that moves it.
 *
 * Tapping expands in place to the full description. Multiple alerts collapse to
 * the most severe with a count, and expanding reveals all of them.
 *
 * Dismissals persist per alert id, so a new warning always appears even if the
 * previous one was dismissed (Decisions Log 59).
 */

const DISMISSED_KEY = "weatherwise.dismissed-alerts";

/** Only these three levels have colours. Statements borrow the advisory tone. */
const TONE: Record<AlertSeverity, { colour: string; background: string; label: string }> = {
  warning: {
    colour: "var(--alert-warning)",
    background: "var(--alert-warning-bg)",
    label: "Warning",
  },
  watch: {
    colour: "var(--alert-watch)",
    background: "var(--alert-watch-bg)",
    label: "Watch",
  },
  advisory: {
    colour: "var(--alert-advisory)",
    background: "var(--alert-advisory-bg)",
    label: "Advisory",
  },
  statement: {
    colour: "var(--alert-advisory)",
    background: "var(--alert-advisory-bg)",
    label: "Statement",
  },
};

function readDismissed(): string[] {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** "Until 9:40 PM", or a range when it does not start now. */
function window_(
  alert: WeatherAlert,
  timeZone: string,
  now: number,
): string | null {
  const { effective, expires } = alert;

  if (effective === null && expires === null) return null;
  if (expires === null) return `From ${formatTime(effective!, timeZone)}`;
  if (effective === null || effective <= now) {
    return `Until ${formatTime(expires, timeZone)}`;
  }

  return `${formatTime(effective, timeZone)} to ${formatTime(expires, timeZone)}`;
}

function AlertBody({
  alert,
  timeZone,
  now,
}: {
  alert: WeatherAlert;
  timeZone: string;
  now: number;
}) {
  const severity = alertSeverity(alert.event);
  const tone = TONE[severity];
  const when = window_(alert, timeZone, now);

  return (
    <div className="flex flex-col gap-1">
      <p
        className="type-label text-2xs"
        style={{ color: tone.colour }}
      >
        {tone.label}
      </p>
      <p className="text-base leading-snug">{alert.event}</p>
      <p className="text-sm text-text-dim">
        {[alert.source, when].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

export function AlertBanner({
  alerts,
  timeZone,
  /**
   * The instant the forecast describes, not the clock. Passed in rather than
   * read here so the window text stays consistent with the rest of the payload,
   * and so this component stays pure.
   */
  now,
}: {
  alerts: WeatherAlert[];
  timeZone: string;
  now: number;
}) {
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  // Read after mount: localStorage does not exist during the server render, and
  // `null` until then means nothing renders rather than flashing a banner that
  // was already dismissed. The lint rule is right in general and wrong here:
  // this is a one-time hydration read with no external system to subscribe to.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDismissed(readDismissed()), []);

  if (dismissed === null) return null;

  const active = [...alerts]
    .filter((alert) => !dismissed.includes(alert.id))
    .sort(compareBySeverity);

  // No container, no spacing, nothing. An absent `alerts` array and an
  // all-dismissed one both land here and must not leave a gap.
  if (active.length === 0) return null;

  const [lead, ...rest] = active;
  const severity = alertSeverity(lead.event);
  const tone = TONE[severity];

  const dismiss = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);

    try {
      window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
    } catch {
      // A full or blocked storage must not stop the banner closing.
    }
  };

  return (
    <section
      aria-label="Severe weather"
      className="alert-surface mx-gutter"
      style={
        {
          "--alert": tone.colour,
          "--alert-bg": tone.background,
        } as React.CSSProperties
      }
    >
      <div className="flex items-start gap-3 p-4">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          className="ww-press min-w-0 flex-1 text-left"
        >
          <AlertBody alert={lead} timeZone={timeZone} now={now} />

          {rest.length > 0 && (
            <p className="type-label mt-2 text-2xs" style={{ color: tone.colour }}>
              +{rest.length} more
            </p>
          )}
        </button>

        <button
          type="button"
          onClick={() => dismiss(lead.id)}
          aria-label={`Dismiss ${lead.event}`}
          className="ww-press shrink-0 rounded-inner p-1 text-text-dim"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>

      {/* Height animates via a grid row rather than max-height, so it lands on
          the real content height instead of an arbitrary cap. */}
      <div className="ww-expand" data-open={expanded}>
        <div>
          <div className="flex flex-col gap-4 px-4 pb-4">
            <p className="selectable text-sm leading-relaxed text-text-dim">
              {lead.description}
            </p>

            {rest.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-3 border-t border-border pt-4"
              >
                <div className="min-w-0 flex-1">
                  <AlertBody alert={alert} timeZone={timeZone} now={now} />
                  <p className="selectable mt-2 text-sm leading-relaxed text-text-dim">
                    {alert.description}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => dismiss(alert.id)}
                  aria-label={`Dismiss ${alert.event}`}
                  className="ww-press shrink-0 rounded-inner p-1 text-text-dim"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
