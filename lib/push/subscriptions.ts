import { neon } from "@neondatabase/serverless";

import { parseRules, type ThresholdRule } from "@/lib/push/rules";

/**
 * Push subscription storage.
 *
 * This is the app's only database. `CLAUDE.md` bans one outright and Decisions
 * Log 7 cut push for exactly this reason; both are overridden by request, and
 * the table is scoped to push alone (Decisions Log 60). Preferences and cached
 * forecasts stay in localStorage as before.
 *
 * Coordinates are stored rounded, and the polling job groups by that rounded
 * pair, so a hundred subscribers in one city cost one API call rather than a
 * hundred. That is what keeps the job inside the quota.
 */

export const COORD_PRECISION = 2;

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
  latitude: number;
  longitude: number;
  rules?: ThresholdRule[];
};

export type StoredSubscription = PushSubscriptionRecord & {
  id: number;
  deliveredAlertIds: string[];
  /** The device's own threshold rules, evaluated per poll. */
  rules: ThresholdRule[];
  /**
   * Whether each rule held last poll, so a rule fires on the transition into
   * its condition rather than every twenty minutes for as long as it lasts.
   */
  ruleState: Record<string, boolean>;
};

/**
 * Two decimal places is about 1.1km. Fine enough that alerts stay locally
 * correct, coarse enough that a neighbourhood collapses to one API call.
 */
export function roundCoordinate(value: number): number {
  return Number(value.toFixed(COORD_PRECISION));
}

function sql() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not set.");
  }

  return neon(url);
}

/**
 * Creates the table if it is missing.
 *
 * Called by the routes rather than kept in a migration tool: this is one table
 * with no history to manage, and a migration framework would be more moving
 * parts than the feature.
 */
export async function ensureSchema(): Promise<void> {
  const query = sql();

  await query`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id                  BIGSERIAL PRIMARY KEY,
      endpoint            TEXT        NOT NULL UNIQUE,
      p256dh              TEXT        NOT NULL,
      auth                TEXT        NOT NULL,
      latitude            NUMERIC(8, 2) NOT NULL,
      longitude           NUMERIC(8, 2) NOT NULL,
      delivered_alert_ids JSONB       NOT NULL DEFAULT '[]'::jsonb,
      rules               JSONB       NOT NULL DEFAULT '[]'::jsonb,
      rule_state          JSONB       NOT NULL DEFAULT '{}'::jsonb,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  // Added after the table shipped, so existing rows need them too. IF NOT
  // EXISTS rather than a migration tool: one table, two columns, no history.
  await query`
    ALTER TABLE push_subscriptions
      ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '[]'::jsonb
  `;

  await query`
    ALTER TABLE push_subscriptions
      ADD COLUMN IF NOT EXISTS rule_state JSONB NOT NULL DEFAULT '{}'::jsonb
  `;

  // The polling job's only query groups by rounded coordinates.
  await query`
    CREATE INDEX IF NOT EXISTS push_subscriptions_coords
      ON push_subscriptions (latitude, longitude)
  `;
}

/**
 * Upsert on endpoint. A browser can hand back the same endpoint after a
 * re-subscribe, and a duplicate row would mean the same device pushed twice.
 */
export async function saveSubscription(
  record: PushSubscriptionRecord,
): Promise<void> {
  const query = sql();

  await query`
    INSERT INTO push_subscriptions
      (endpoint, p256dh, auth, latitude, longitude, rules)
    VALUES (
      ${record.endpoint},
      ${record.p256dh},
      ${record.auth},
      ${roundCoordinate(record.latitude)},
      ${roundCoordinate(record.longitude)},
      ${JSON.stringify(parseRules(record.rules ?? []))}::jsonb
    )
    ON CONFLICT (endpoint) DO UPDATE SET
      p256dh     = EXCLUDED.p256dh,
      auth       = EXCLUDED.auth,
      latitude   = EXCLUDED.latitude,
      longitude  = EXCLUDED.longitude,
      rules      = EXCLUDED.rules,
      updated_at = now()
  `;
}

/** Follows a saved-location change without re-subscribing the device. */
export async function updateSubscriptionLocation(
  endpoint: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const query = sql();

  await query`
    UPDATE push_subscriptions
       SET latitude = ${roundCoordinate(latitude)},
           longitude = ${roundCoordinate(longitude)},
           updated_at = now()
     WHERE endpoint = ${endpoint}
  `;
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  const query = sql();
  await query`DELETE FROM push_subscriptions WHERE endpoint = ${endpoint}`;
}

/**
 * Every subscription, grouped by rounded coordinate.
 *
 * The grouping is what makes the poll affordable: one One Call request per key,
 * however many devices share it.
 */
export async function subscriptionsByLocation(): Promise<
  Map<string, StoredSubscription[]>
> {
  const query = sql();

  const rows = (await query`
    SELECT id, endpoint, p256dh, auth, latitude, longitude,
           delivered_alert_ids, rules, rule_state
      FROM push_subscriptions
  `) as Record<string, unknown>[];

  const groups = new Map<string, StoredSubscription[]>();

  for (const row of rows) {
    const latitude = Number(row.latitude);
    const longitude = Number(row.longitude);
    const key = `${latitude},${longitude}`;

    const delivered = row.delivered_alert_ids;

    const subscription: StoredSubscription = {
      id: Number(row.id),
      endpoint: String(row.endpoint),
      p256dh: String(row.p256dh),
      auth: String(row.auth),
      latitude,
      longitude,
      deliveredAlertIds: Array.isArray(delivered)
        ? delivered.filter((id): id is string => typeof id === "string")
        : [],
      // Re-validated on the way out as well as in. The column is JSONB, so a
      // row written by an older build, or by hand, is not guaranteed to match
      // the current shape.
      rules: parseRules(row.rules),
      ruleState:
        typeof row.rule_state === "object" && row.rule_state !== null
          ? (row.rule_state as Record<string, boolean>)
          : {},
    };

    groups.set(key, [...(groups.get(key) ?? []), subscription]);
  }

  return groups;
}

/**
 * Records a delivery so the same alert is never sent twice.
 *
 * Appended in the database rather than read-modify-write from the app, so two
 * overlapping job runs cannot lose each other's writes. Getting the same
 * warning every twenty minutes for six hours is the fastest route to an
 * uninstall.
 */
export async function markAlertDelivered(
  id: number,
  alertId: string,
): Promise<void> {
  const query = sql();

  await query`
    UPDATE push_subscriptions
       SET delivered_alert_ids =
             CASE WHEN delivered_alert_ids @> ${JSON.stringify([alertId])}::jsonb
                  THEN delivered_alert_ids
                  ELSE delivered_alert_ids || ${JSON.stringify([alertId])}::jsonb
             END,
           updated_at = now()
     WHERE id = ${id}
  `;
}

/** Replaces a device's rules without touching its subscription or location. */
export async function updateSubscriptionRules(
  endpoint: string,
  rules: ThresholdRule[],
): Promise<void> {
  const query = sql();

  await query`
    UPDATE push_subscriptions
       SET rules = ${JSON.stringify(parseRules(rules))}::jsonb,
           updated_at = now()
     WHERE endpoint = ${endpoint}
  `;
}

/**
 * Writes back which rules held this poll.
 *
 * Merged into the existing object rather than replacing it, so a rule the user
 * has since disabled keeps its last known state: re-enabling it should not fire
 * a notification for a condition that never changed.
 */
export async function saveRuleState(
  id: number,
  state: Record<string, boolean>,
): Promise<void> {
  const query = sql();

  await query`
    UPDATE push_subscriptions
       SET rule_state = rule_state || ${JSON.stringify(state)}::jsonb,
           updated_at = now()
     WHERE id = ${id}
  `;
}
