"use client";

import { DEFAULT_LOCATION } from "@/lib/location";
import { activeLocation } from "@/lib/preferences";
import { readPreferences } from "@/lib/preferences-store";
import type { ThresholdRule } from "@/lib/push/rules";

/**
 * Browser side of Web Push.
 *
 * Deliberately free of React: the capability checks are the fiddly part and are
 * easier to reason about, and test, as plain functions.
 */

export type PushSupport =
  | { state: "ready" }
  /** iOS only delivers push to an installed app, so the toggle is replaced. */
  | { state: "needs-install" }
  | { state: "unsupported" };

export type PushPermission = "granted" | "denied" | "default";

/** iPad reports as Mac, so touch points are what actually distinguishes it. */
function isIos(): boolean {
  const ua = navigator.userAgent;
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own flag, which predates the media query and is still the only
    // reliable signal on older iOS.
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function pushSupport(): PushSupport {
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    // On iOS outside standalone the APIs are simply absent, which is a
    // fixable state rather than an unsupported browser.
    return isIos() && !isStandalone() ? { state: "needs-install" } : { state: "unsupported" };
  }

  if (isIos() && !isStandalone()) return { state: "needs-install" };

  return { state: "ready" };
}

/**
 * The coordinates alerts should follow, read at call time rather than passed
 * in. Everything that mirrors state to the server needs them, and threading
 * them through every call site would mean four signatures changing together.
 */
function activeCoordinates(): { latitude: number; longitude: number } {
  const saved = activeLocation(readPreferences());

  return saved
    ? { latitude: saved.latitude, longitude: saved.longitude }
    : DEFAULT_LOCATION;
}

export function currentPermission(): PushPermission {
  if (!("Notification" in window)) return "default";
  return Notification.permission as PushPermission;
}

/**
 * VAPID keys travel as base64url and `applicationServerKey` needs bytes.
 *
 * Backed by an explicit ArrayBuffer rather than `Uint8Array.from`, because the
 * DOM type requires a view over a plain ArrayBuffer and the inferred
 * ArrayBufferLike admits SharedArrayBuffer.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalised);

  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;

  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushSupport().state !== "ready") return null;

  const registered = await navigator.serviceWorker.getRegistration();
  return (await registered?.pushManager.getSubscription()) ?? null;
}

/**
 * Requests permission and subscribes.
 *
 * Only ever called from a direct tap on the Settings toggle, after the priming
 * screen. Never on load and never on a timer: a prompt the user declines can
 * never be shown again, so it has to be asked for at a moment they understand.
 */
export async function enablePush(
  publicKey: string,
  location: { latitude: number; longitude: number },
): Promise<{ ok: boolean; permission: PushPermission }> {
  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    return { ok: false, permission: permission as PushPermission };
  }

  const registered = await registration();

  const subscription =
    (await registered.pushManager.getSubscription()) ??
    (await registered.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));

  const response = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      latitude: location.latitude,
      longitude: location.longitude,
      // Rules can be configured before push is switched on, so they ride along
      // with the subscription rather than needing a second call afterwards.
      rules: readPreferences().alertRules,
    }),
  });

  return { ok: response.ok, permission: "granted" };
}

/** Unsubscribes locally and deletes the row, so a dead endpoint is not kept. */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;

  const { endpoint } = subscription;

  await subscription.unsubscribe().catch(() => undefined);

  await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);
}

/**
 * Follows a saved-location change.
 *
 * Silent by design: it runs whenever the active location changes, and a failure
 * means alerts arrive for the previous city, which is not worth an error state
 * in Settings.
 */
export async function updatePushLocation(location: {
  latitude: number;
  longitude: number;
}): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;

  await fetch("/api/push/subscribe", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      latitude: location.latitude,
      longitude: location.longitude,
    }),
  }).catch(() => undefined);
}

/**
 * Mirrors the device's threshold rules to the server.
 *
 * Silent where there is no subscription: rules are perfectly valid to configure
 * before turning push on, and they are sent again with the subscription itself
 * when it is created, so nothing is lost by the no-op.
 *
 * PATCH carries the current location too, because the endpoint requires it and
 * resending what the server already has is cheaper than a second route.
 */
export async function updatePushRules(rules: ThresholdRule[]): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;

  const location = activeCoordinates();

  await fetch("/api/push/subscribe", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: subscription.endpoint,
      latitude: location.latitude,
      longitude: location.longitude,
      rules,
    }),
  }).catch(() => undefined);
}
