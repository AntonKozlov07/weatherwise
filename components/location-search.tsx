"use client";

import { useEffect, useState } from "react";

import { locationId, type SavedLocation } from "@/lib/preferences";
import type { CityMatch } from "@/lib/weather/types";

/** Long enough that typing a city does not fire a request per keystroke. */
const DEBOUNCE_MS = 350;
const MIN_QUERY = 2;

type Props = {
  onSelect: (location: SavedLocation) => void;
  /** Ids already saved, shown as such rather than offered again. */
  existingIds?: string[];
};

export function LocationSearch({ onSelect, existingIds = [] }: Props) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<CityMatch[]>([]);
  const [status, setStatus] = useState<"idle" | "searching" | "error">("idle");

  const trimmed = query.trim();
  const longEnough = trimmed.length >= MIN_QUERY;
  // Derived, not cleared. Wiping the list in the effect when the query gets
  // too short would be a cascading render for something render already knows.
  const visible = longEnough ? matches : [];

  useEffect(() => {
    if (trimmed.length < MIN_QUERY) return;

    const controller = new AbortController();

    // Debounced, and every state change happens inside the timer callback:
    // setting status synchronously here would cascade a render per keystroke.
    const timer = setTimeout(async () => {
      setStatus("searching");

      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );

        if (!response.ok) {
          setStatus("error");
          return;
        }

        const body = (await response.json()) as { matches: CityMatch[] };
        setMatches(body.matches);
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) setStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-2">
        <span className="type-label text-xs">Search for a city</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Guelph"
          className="selectable rounded-inner border border-hairline bg-surface px-4 py-3 text-base outline-none focus:border-accent"
        />
      </label>

      {status === "error" && (
        <p className="text-sm text-text-dim">
          City search is unavailable right now.
        </p>
      )}

      {status === "idle" && longEnough && visible.length === 0 && (
        <p className="text-sm text-text-dim">No cities match that.</p>
      )}

      <ul className="flex flex-col gap-2">
        {visible.map((match) => {
          const id = locationId(match.latitude, match.longitude);
          const saved = existingIds.includes(id);

          return (
            <li key={match.id}>
              <button
                type="button"
                disabled={saved}
                onClick={() =>
                  onSelect({
                    id,
                    name: match.name,
                    region: match.region,
                    country: match.country,
                    latitude: match.latitude,
                    longitude: match.longitude,
                  })
                }
                className="ww-press flex w-full items-center justify-between gap-3 rounded-inner bg-surface px-4 py-3 text-left disabled:opacity-45"
              >
                <span className="min-w-0">
                  <span className="block truncate text-base">{match.name}</span>
                  <span className="block truncate text-sm text-text-dim">
                    {[match.region, match.country].filter(Boolean).join(", ")}
                  </span>
                </span>
                <span className="type-label shrink-0 text-[0.625rem]">
                  {saved ? "Saved" : "Add"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
