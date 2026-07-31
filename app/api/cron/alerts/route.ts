import { firingRules, ruleMessage } from "@/lib/push/rules";
import { sendAlert } from "@/lib/push/send";
import {
  ensureSchema,
  markAlertDelivered,
  saveRuleState,
  subscriptionsByLocation,
} from "@/lib/push/subscriptions";
import {
  fetchAlerts,
  fetchCurrent,
  fetchHourly,
} from "@/lib/weather/openweather/client";
import { normalizeAlerts, normalizeCurrent, normalizeHourly } from "@/lib/weather/normalize";
import { compareBySeverity, isPushWorthy } from "@/lib/weather/severity";

/**
 * Severe weather push poll.
 *
 * One One Call request per distinct rounded coordinate, however many devices
 * share it, which is what keeps this inside the API quota.
 *
 * Only watches and warnings are sent. Advisories and statements are visible in
 * the app and never interrupt anyone (`isPushWorthy`, shared with the banner so
 * the two cannot disagree).
 *
 * Deduplicated per subscription against the delivered list before sending, and
 * the id written back after. Without that, a six hour warning would push every
 * time the job runs.
 *
 * The same run also evaluates each device's own threshold rules. Those are kept
 * visibly separate from the official alerts: a rule about laundry weather must
 * never be dressed up as a government warning. They fire only on the transition
 * into their condition, never for as long as it lasts (Decisions Log 69).
 *
 * The hourly fetch that the rules need is made once per coordinate group and
 * only where some device in that group actually has rules, so a run with no
 * custom rules costs exactly what it did before.
 *
 * Protected by CRON_SECRET. Vercel Cron sends it as a bearer token; an external
 * scheduler must send the same header.
 */

export const maxDuration = 60;

function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  // Refuses rather than running unprotected: this endpoint sends notifications
  // to real devices and must never be open.
  if (!secret) return false;

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!authorised(request)) {
    return new Response("Unauthorised", { status: 401 });
  }

  const summary = {
    groups: 0,
    considered: 0,
    sent: 0,
    expired: 0,
    failed: 0,
    rulesFired: 0,
  };

  try {
    await ensureSchema();
    const groups = await subscriptionsByLocation();
    summary.groups = groups.size;

    for (const [key, subscribers] of groups) {
      const [latitude, longitude] = key.split(",").map(Number);

      const needsRules = subscribers.some((subscriber) =>
        subscriber.rules.some((rule) => rule.enabled),
      );

      let pushWorthy;
      let ruleInput = null;

      try {
        const current = await fetchCurrent(latitude, longitude);
        const details = await fetchAlerts(current.data[0]?.alerts ?? []);

        pushWorthy = normalizeAlerts(details)
          .filter((alert) => isPushWorthy(alert.event))
          .sort(compareBySeverity);

        const reading = current.data[0];

        if (needsRules && reading) {
          const hourly = await fetchHourly(latitude, longitude);

          ruleInput = {
            current: normalizeCurrent(reading),
            hourly: normalizeHourly(hourly, Date.now()),
          };
        }
      } catch (error) {
        // One bad location must not stop the rest of the run.
        console.error(`Alert poll failed for ${key}:`, (error as Error).message);
        continue;
      }

      // Threshold rules are evaluated even when there are no official alerts,
      // which is the usual case: most days have no warning and plenty have a
      // frost.
      if (ruleInput) {
        for (const subscriber of subscribers) {
          const { firing, nextState } = firingRules(
            subscriber.rules,
            subscriber.ruleState,
            ruleInput,
          );

          for (const rule of firing) {
            const message = ruleMessage(rule, ruleInput);

            const outcome = await sendAlert(subscriber, {
              alertId: `rule:${rule.id}`,
              event: message.title,
              description: message.body,
              latitude: subscriber.latitude,
              longitude: subscriber.longitude,
            });

            if (outcome === "sent") summary.rulesFired += 1;
            else if (outcome === "failed") summary.failed += 1;
          }

          // Written back whatever the send outcome. A rule whose notification
          // failed should not retry forever; the condition will transition
          // again, and that is the moment worth interrupting someone for.
          if (Object.keys(nextState).length > 0) {
            await saveRuleState(subscriber.id, nextState);
          }
        }
      }

      if (pushWorthy.length === 0) continue;
      summary.considered += pushWorthy.length;

      for (const subscriber of subscribers) {
        for (const alert of pushWorthy) {
          if (subscriber.deliveredAlertIds.includes(alert.id)) continue;

          const outcome = await sendAlert(subscriber, {
            alertId: alert.id,
            event: alert.event,
            description: alert.description || alert.event,
            latitude: subscriber.latitude,
            longitude: subscriber.longitude,
          });

          if (outcome === "sent") {
            summary.sent += 1;
            // Only after a confirmed send, so a failure is retried next run
            // rather than silently swallowed.
            await markAlertDelivered(subscriber.id, alert.id);
          } else if (outcome === "expired") {
            summary.expired += 1;
            break;
          } else {
            summary.failed += 1;
          }
        }
      }
    }

    return Response.json(summary);
  } catch (error) {
    console.error("Alert cron failed:", (error as Error).message);
    return Response.json(
      { error: { message: "Alert poll failed." }, summary },
      { status: 500 },
    );
  }
}
