"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BottomNav } from "@/components/bottom-nav";
import { LocationSearch } from "@/components/location-search";
import { resetPreferences, updatePreferences, usePreferences } from "@/components/preferences-provider";
import { GhostButton, OptionGroup, TextField, Toggle } from "@/components/ui";
import type { FontSize, SavedLocation, Theme, Units } from "@/lib/preferences";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="type-label text-xs">{title}</h2>
      {children}
    </section>
  );
}

export function Settings() {
  const router = useRouter();
  const preferences = usePreferences();
  const [confirmingReset, setConfirmingReset] = useState(false);

  const addLocation = (location: SavedLocation) => {
    if (preferences.locations.some((saved) => saved.id === location.id)) return;

    updatePreferences({
      locations: [...preferences.locations, location],
      activeLocationId: preferences.activeLocationId ?? location.id,
    });
  };

  const removeLocation = (id: string) => {
    const locations = preferences.locations.filter(
      (location) => location.id !== id,
    );

    updatePreferences({
      locations,
      // Dropping the active location has to hand over to another one, or the
      // home screen falls back to its default with no way back.
      activeLocationId:
        preferences.activeLocationId === id
          ? (locations[0]?.id ?? null)
          : preferences.activeLocationId,
    });
  };

  return (
    <div className="screen">
      <main className="screen-scroll ww-rise flex flex-col gap-9 px-5 pb-6 pt-6">
        <h1 className="type-heading text-2xl">Settings</h1>

        <Section title="You">
          <TextField
            label="Name in the greeting"
            value={preferences.name}
            onChange={(name) => updatePreferences({ name })}
            placeholder="Optional"
          />
        </Section>

        <Section title="Display">
          <OptionGroup<Units>
            label="Units"
            value={preferences.units}
            onChange={(units) => updatePreferences({ units })}
            options={[
              { value: "metric", label: "Metric" },
              { value: "imperial", label: "Imperial" },
            ]}
          />

          <OptionGroup<Theme>
            label="Theme"
            hint="Midnight is true black, for OLED screens."
            value={preferences.theme}
            onChange={(theme) => updatePreferences({ theme })}
            options={[
              { value: "dark", label: "Dark" },
              { value: "midnight", label: "Midnight" },
            ]}
          />

          <OptionGroup<FontSize>
            label="Text size"
            value={preferences.fontSize}
            onChange={(fontSize) => updatePreferences({ fontSize })}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />
        </Section>

        <Section title="Notifications">
          <Toggle
            label="Alert banners"
            hint="Shows severe weather warnings inside the app. This does not send push notifications."
            checked={preferences.alertBanners}
            onChange={(alertBanners) => updatePreferences({ alertBanners })}
          />
        </Section>

        <Section title="Saved locations">
          {preferences.locations.length === 0 ? (
            <p className="text-sm text-text-dim">
              Nothing saved yet. Search below to add one.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {preferences.locations.map((location) => {
                const active = location.id === preferences.activeLocationId;

                return (
                  <li
                    key={location.id}
                    className="flex items-center gap-3 rounded-inner bg-surface px-4 py-3"
                  >
                    <button
                      type="button"
                      onClick={() => updatePreferences({ activeLocationId: location.id })}
                      aria-pressed={active}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-base">
                        {location.name}
                      </span>
                      <span className="block truncate text-sm text-text-dim">
                        {[location.region, location.country]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </button>

                    {active && (
                      <span className="type-label shrink-0 text-[0.625rem] text-accent">
                        Showing
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => removeLocation(location.id)}
                      aria-label={`Remove ${location.name}`}
                      className="ww-press shrink-0 rounded-inner p-1 text-text-dim"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <LocationSearch
            onSelect={addLocation}
            existingIds={preferences.locations.map((location) => location.id)}
          />
        </Section>

        <Section title="Reset">
          {confirmingReset ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-text-dim">
                This clears your name, preferences, and saved locations, and
                starts onboarding again.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    resetPreferences();
                    router.replace("/onboarding");
                  }}
                  className="ww-press rounded-pill bg-surface-raised px-5 py-3 text-sm"
                >
                  Reset everything
                </button>
                <GhostButton onClick={() => setConfirmingReset(false)}>
                  Cancel
                </GhostButton>
              </div>
            </div>
          ) : (
            <GhostButton onClick={() => setConfirmingReset(true)}>
              Reset onboarding
            </GhostButton>
          )}
        </Section>
      </main>

      <BottomNav />
    </div>
  );
}

