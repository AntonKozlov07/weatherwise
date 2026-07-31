"use client";

import { updatePreferences } from "@/components/preferences-provider";
import { haptic } from "@/lib/haptics";
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
 * idiom for selection. Absent with one location or none, because a control
 * offering a single choice is decoration.
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
  if (locations.length < 2) return null;

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

                haptic("select");
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
      </div>
    </nav>
  );
}
