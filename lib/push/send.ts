import webpush from "web-push";

import type { StoredSubscription } from "./subscriptions";
import { deleteSubscription } from "./subscriptions";

/**
 * Sending side of Web Push.
 *
 * Never logs an endpoint or any key: an endpoint is a capability URL, and
 * anyone holding it can push to that device.
 */

/** Truncated so the body is readable on a lock screen rather than a wall. */
const BODY_LIMIT = 180;

let configured = false;

function configure(): void {
  if (configured) return;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    throw new Error(
      "Push is not configured. Needs NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT.",
    );
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export function truncate(text: string, limit = BODY_LIMIT): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= limit) return clean;

  // Cut on a word boundary so the body does not end mid-word.
  const cut = clean.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");

  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export type AlertPayload = {
  alertId: string;
  event: string;
  description: string;
  latitude: number;
  longitude: number;
};

export type SendOutcome = "sent" | "expired" | "failed";

/**
 * Sends one alert to one subscription.
 *
 * A 404 or 410 means the browser has discarded the subscription and it will
 * never work again, so the row is deleted. Anything else is logged and kept:
 * a transient 500 from a push service is not a reason to lose a subscriber.
 */
export async function sendAlert(
  subscription: StoredSubscription,
  payload: AlertPayload,
): Promise<SendOutcome> {
  configure();

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify({
        title: payload.event,
        body: truncate(payload.description),
        badge: "/icons/manifest-icon-192.maskable.png",
        icon: "/icons/manifest-icon-192.maskable.png",
        tag: payload.alertId,
        data: {
          alertId: payload.alertId,
          latitude: payload.latitude,
          longitude: payload.longitude,
        },
      }),
    );

    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;

    if (status === 404 || status === 410) {
      await deleteSubscription(subscription.endpoint);
      return "expired";
    }

    // Subscription id only. The endpoint itself is a secret.
    console.error(
      `Push failed for subscription ${subscription.id}: status ${status ?? "unknown"}`,
    );

    return "failed";
  }
}
