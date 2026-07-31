"use client";

import { useCallback, useEffect, useState } from "react";

import {
  currentPermission,
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  updatePushLocation,
  type PushPermission,
  type PushSupport,
} from "@/lib/push/client";
import { activeLocation, type Preferences } from "@/lib/preferences";

import { GhostButton, PrimaryButton, Toggle } from "./ui";

/**
 * Severe weather push, in Settings.
 *
 * Off by default, and the native prompt only ever fires from a tap on the
 * toggle, after the priming screen. A declined prompt can never be shown again,
 * so priming preserves the user's ability to say yes later (Decisions Log 61).
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function PushSettings({ preferences }: { preferences: Preferences }) {
  const [support, setSupport] = useState<PushSupport | null>(null);
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [priming, setPriming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const location = activeLocation(preferences);

  const refresh = useCallback(async () => {
    // Awaited first, so every state write happens in an async continuation
    // rather than synchronously in an effect body. Browser capability is an
    // external system with nothing to subscribe to, so this is a read, not a
    // derivation that belongs in render.
    const subscription = await currentSubscription();

    setSupport(pushSupport());
    setPermission(currentPermission());
    setSubscribed(subscription !== null);
  }, []);

  useEffect(() => {
    // Reading browser permission and the existing subscription is exactly the
    // "subscribe to an external system" case the rule exists for; it just
    // cannot tell, because the read is a promise rather than a listener.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // A saved-location change has to follow the subscription, or alerts keep
  // arriving for the city the user just left.
  useEffect(() => {
    if (!subscribed || !location) return;

    void updatePushLocation({
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }, [subscribed, location]);

  if (support === null) return null;

  // iOS delivers push only to an installed app. A toggle here would simply
  // fail, so it is replaced with the thing that would fix it.
  if (support.state === "needs-install") {
    return (
      <div className="card p-4">
        <p className="text-base">Severe weather alerts</p>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          On iPhone, notifications work once WeatherWise is on your Home Screen.
          Tap Share, then Add to Home Screen, and open it from there.
        </p>
      </div>
    );
  }

  if (support.state === "unsupported") {
    return (
      <div className="card p-4">
        <p className="text-base">Severe weather alerts</p>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          This browser cannot receive notifications.
        </p>
      </div>
    );
  }

  // Permission is permanent once refused; the prompt cannot be raised again, so
  // the only honest instruction is where to change it.
  if (permission === "denied") {
    return (
      <div className="card p-4">
        <p className="text-base">Severe weather alerts</p>
        <p className="mt-2 text-sm leading-relaxed text-text-dim">
          Notifications are blocked for WeatherWise. Re-enable them in your
          browser or system settings, then come back here.
        </p>
      </div>
    );
  }

  const onToggle = async (next: boolean) => {
    setError(null);

    if (!next) {
      setBusy(true);
      await disablePush();
      await refresh();
      setBusy(false);
      return;
    }

    if (!location) {
      setError("Save a location first, so alerts know where to watch.");
      return;
    }

    if (!VAPID_PUBLIC_KEY) {
      setError("Notifications are not configured on this deployment.");
      return;
    }

    // The prime comes first. The native prompt only fires from the button on it.
    setPriming(true);
  };

  const confirmPrime = async () => {
    if (!location) return;

    setBusy(true);
    setPriming(false);

    try {
      const result = await enablePush(VAPID_PUBLIC_KEY, {
        latitude: location.latitude,
        longitude: location.longitude,
      });

      if (!result.ok && result.permission === "granted") {
        setError("Could not register for alerts. Try again in a moment.");
      }
    } catch {
      setError("Could not register for alerts. Try again in a moment.");
    } finally {
      await refresh();
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Toggle
        label="Severe weather alerts"
        hint="A notification when a watch or warning is issued for your saved location. Advisories stay in the app."
        checked={subscribed}
        onChange={(next) => void onToggle(next)}
      />

      {busy && <p className="text-sm text-text-dim">Working…</p>}

      {error && (
        <p role="status" className="text-sm text-alert-warning">
          {error}
        </p>
      )}

      {priming && (
        <div className="card flex flex-col gap-4 p-4">
          <div>
            <p className="text-base">Before we ask</p>
            <p className="mt-2 text-sm leading-relaxed text-text-dim">
              Your browser will ask permission next. WeatherWise sends one kind
              of notification: severe weather watches and warnings for{" "}
              {location?.name ?? "your saved location"}. Nothing else, and
              usually not at all in a given month.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <PrimaryButton onClick={() => void confirmPrime()}>
                Continue
              </PrimaryButton>
            </div>
            {/* Declining here never raises the native prompt, so the user can
                still say yes another day. */}
            <GhostButton onClick={() => setPriming(false)}>Not now</GhostButton>
          </div>
        </div>
      )}
    </div>
  );
}
