"use client";

import { useState } from "react";

import type { WeatherAlert } from "@/lib/weather/types";

/**
 * Severe weather banner, above the greeting, dismissible.
 *
 * Dismissal is keyed on the alert id rather than its position, so a refetch
 * does not bring a dismissed warning back. It is deliberately not persisted:
 * an alert still in effect on the next launch is worth showing again.
 */
export function AlertBanner({ alerts }: { alerts: WeatherAlert[] }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const active = alerts.find((alert) => !dismissed.includes(alert.id));

  if (!active) return null;

  return (
    <div
      role="alert"
      className="mx-5 flex items-start gap-3 rounded-inner border border-hairline bg-surface-raised px-4 py-3"
    >
      <div className="min-w-0 flex-1">
        <p className="type-label text-[0.6875rem]">{active.event}</p>
        <p className="mt-1 text-sm leading-snug">{active.headline}</p>
      </div>

      <button
        type="button"
        onClick={() => setDismissed((current) => [...current, active.id])}
        aria-label={`Dismiss ${active.event}`}
        className="rounded-inner p-1 text-text-dim"
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
  );
}
