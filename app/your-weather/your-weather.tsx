"use client";

import { BottomNav } from "@/components/bottom-nav";
import { ProfileQuestions } from "@/components/profile-questions";
import { updatePreferences, usePreferences } from "@/components/preferences-provider";
import { GhostButton } from "@/components/ui";
import { EMPTY_PROFILE, hasProfile } from "@/lib/profile/profile";

/**
 * Your weather.
 *
 * The same five questions onboarding asks, so they can be changed or cleared
 * later. Answers save as they are tapped: there is no submit, because there is
 * nothing to validate and a save button on a preferences screen is a step that
 * only exists to be forgotten (Decisions Log 117).
 */
export function YourWeather() {
  const preferences = usePreferences();
  const profile = preferences.weatherProfile;

  return (
    <div className="screen">
      <main className="screen-scroll ww-rise page-gutter flex flex-col gap-8 pb-6 pt-2">
        <header>
          <h1 className="screen-title">Your weather</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-dim">
            What you like and dislike, so the summary on the home screen is about
            your day rather than the weather in general. Answer as many or as few
            as you want.
          </p>
        </header>

        <ProfileQuestions
          profile={profile}
          onChange={(weatherProfile) => updatePreferences({ weatherProfile })}
        />

        {hasProfile(profile) && (
          <GhostButton
            onClick={() => updatePreferences({ weatherProfile: EMPTY_PROFILE })}
          >
            Clear my answers
          </GhostButton>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
