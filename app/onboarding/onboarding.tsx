"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { LocationSearch } from "@/components/location-search";
import { ProfileQuestions } from "@/components/profile-questions";
import { updatePreferences, usePreferences } from "@/components/preferences-provider";
import { GhostButton, OptionGroup, PrimaryButton, TextField, Toggle } from "@/components/ui";
import type { FontSize, SavedLocation, Theme, Units } from "@/lib/preferences";

/**
 * Four steps: Welcome, Personalize, Your weather, Location.
 *
 * The fourth was added last and sits before Location deliberately: it is the
 * one a reader is most likely to skip, and putting it after the thing they came
 * for would mean answering questions once the app is already usable
 * (Decisions Log 117).
 *
 * There is no login or signup anywhere in here. The original Figma had four
 * such screens and they are cut (Decisions Log 1), as is the language selector
 * (Decisions Log 3).
 */
const STEPS = ["Welcome", "Personalize", "Your weather", "Location"] as const;

function Dots({ step }: { step: number }) {
  return (
    <div className="flex justify-center gap-2" aria-hidden="true">
      {STEPS.map((_, index) => (
        <span
          key={index}
          className="h-1.5 rounded-pill transition-all duration-300"
          style={{
            width: index === step ? "1.5rem" : "0.375rem",
            backgroundColor:
              index === step ? "var(--accent)" : "var(--surface-raised)",
          }}
        />
      ))}
    </div>
  );
}

export function Onboarding() {
  const router = useRouter();
  const preferences = usePreferences();
  const [step, setStep] = useState(0);

  const finish = (location?: SavedLocation) => {
    updatePreferences({
      onboarded: true,
      ...(location
        ? { locations: [location], activeLocationId: location.id }
        : {}),
    });
    router.replace("/");
  };

  return (
    // `.screen` fills what the shell leaves, rather than `min-h-dvh` which is
    // the whole viewport and therefore taller than the shell's content box once
    // the safe-area insets are applied. That overflow is what pushed the
    // Continue button off the bottom of the screen (Decisions Log 52).
    <main className="screen page-gutter">
      {/* Steps scroll; the dots and buttons below never do, so Continue is
          always reachable no matter how short the phone is. */}
      <div
        key={step}
        className="screen-scroll ww-rise flex min-h-0 flex-col gap-8 py-8"
      >
        {step === 0 && (
          <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-8 text-center">
            <Image
              src="/brand/Logo_Larger_Version.svg"
              alt=""
              width={84}
              height={80}
              priority
              unoptimized
            />
            <Image
              src="/brand/Special_Text_Version.svg"
              alt="WeatherWise"
              width={256}
              height={20}
              priority
              unoptimized
            />
            <p className="max-w-xs text-base leading-relaxed text-text-dim">
              Weather for where you are, read at a glance. The greeting changes
              colour with the sky.
            </p>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-8 pt-6">
            <h1 className="type-heading text-2xl">A few preferences</h1>

            <TextField
              label="What should we call you?"
              value={preferences.name}
              onChange={(name) => updatePreferences({ name })}
              placeholder="Optional"
              autoFocus
            />

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

            <Toggle
              label="Alert banners"
              // Push notifications are cut from v1 (Decisions Log 7), so the
              // label has to be clear that this is in-app only.
              hint="Shows severe weather warnings inside the app. This does not send push notifications."
              checked={preferences.alertBanners}
              onChange={(alertBanners) => updatePreferences({ alertBanners })}
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-6 pt-6">
            <div>
              <h1 className="type-heading text-2xl">A few questions</h1>
              <p className="mt-3 text-base text-text-dim">
                What you like and dislike about weather, so the summary on the
                home screen is about your day rather than the weather in
                general. Skip it and nothing changes.
              </p>
            </div>

            <ProfileQuestions
              profile={preferences.weatherProfile}
              onChange={(weatherProfile) => updatePreferences({ weatherProfile })}
            />
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-6 pt-6">
            <h1 className="type-heading text-2xl">Where are you?</h1>
            <p className="text-base text-text-dim">
              Pick a city to start with. You can add more later.
            </p>
            <LocationSearch onSelect={(location) => finish(location)} />
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-6 pb-6 pt-4">
        <Dots step={step} />

        <div className="flex items-center gap-3">
          {step > 0 && (
            <GhostButton onClick={() => setStep((current) => current - 1)}>
              Back
            </GhostButton>
          )}

          <div className="flex-1">
            {step < 3 ? (
              <PrimaryButton onClick={() => setStep((current) => current + 1)}>
                {step === 2 ? "Done" : "Continue"}
              </PrimaryButton>
            ) : (
              // Skipping leaves no saved location, and the home screen falls
              // back to its default until one is added in Settings.
              <button
                type="button"
                onClick={() => finish()}
                className="ww-press w-full rounded-pill border border-border px-6 py-4 text-base"
              >
                Skip for now
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

