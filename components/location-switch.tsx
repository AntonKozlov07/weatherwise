"use client";

import Link from "next/link";

import { updatePreferences } from "@/components/preferences-provider";
import { updatePushLocation } from "@/lib/push/client";
import type { SavedLocation } from "@/lib/preferences";

/**
 * Switching between saved locations, from the home screen.
 *
 * Saved locations existed for a long time with no way to change which one you
 * were looking at except a trip into Settings, which made the whole feature
 * close to unusable (Decisions Log 81).
 *
 * The same underline treatment as the Explore categories, rather than a third
 * idiom for selection.
 *
 * Shown with a single saved location, not just with two. Hiding it until there
 * were two made it invisible to anyone who had not already added a second, which
 * is precisely the person who needs to find it. The trailing link is how the
 * second one gets added (Decisions Log 85).
 *
 * Alerts follow the switch. A push subscription pinned to a city you are no
 * longer looking at would warn you about the wrong weather.
 */
export function LocationSwitch({
  locations,
  activeId,
}: {
  locations: SavedLocation[];
  activeId: string | null;
}) {
  // Nothing saved at all means onboarding has not run or the default location
  // is in use, and there is nothing to switch between yet.
  if (locations.length === 0) return null;

  return (
    <nav
      aria-label="Saved locations"
      className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="page-gutter flex gap-5">
        {locations.map((location) => {
          const selected = location.id === activeId;

          return (
            <button
              key={location.id}
              type="button"
              aria-current={selected ? "true" : undefined}
              onClick={() => {
                if (selected) return;

                updatePreferences({ activeLocationId: location.id });

                // Silent by design: a failure means alerts keep arriving for
                // the previous city, which is not worth an error state here.
                void updatePushLocation({
                  latitude: location.latitude,
                  longitude: location.longitude,
                });
              }}
              className="ww-tab type-label shrink-0 whitespace-nowrap px-1 pb-2 pt-1 text-2xs"
              data-selected={selected || undefined}
            >
              {location.name}
            </button>
          );
        })}

        {/* Always present, so adding a second location is reachable from the
            screen you would think to look on. */}
        <Link
          href="/settings"
          className="ww-tab type-label shrink-0 whitespace-nowrap px-1 pb-2 pt-1 text-2xs"
        >
          + Add
        </Link>
      </div>
    </nav>
  );
}
