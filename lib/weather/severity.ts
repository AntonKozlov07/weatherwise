/**
 * Alert severity, derived from the event name.
 *
 * One Call 4.0 alert details carry `sender_name`, `event`, `start`, `end` and
 * `description` and nothing else. There is no severity, urgency or certainty
 * field, unlike the previous vendor, so the event name is the only signal
 * available (Decisions Log 55).
 *
 * Shared deliberately: the banner styles from this and the push job decides
 * whether to send from it. Two copies would drift, and the failure mode is
 * pushing an advisory at three in the morning.
 *
 * Framework-free, so the cron job can import it on the server.
 */

export type AlertSeverity = "warning" | "watch" | "advisory" | "statement";

/** Ascending. Used to rank alerts and to gate what may be pushed. */
export const SEVERITY_RANK: Record<AlertSeverity, number> = {
  statement: 0,
  advisory: 1,
  watch: 2,
  warning: 3,
};

/**
 * Matched in order, most severe first, so "Severe Thunderstorm Warning" is a
 * warning even though it also contains no other keyword, and a hypothetical
 * "Watch Statement" ranks as the watch.
 *
 * Emergency and special weather wording is included because national services
 * use it for their most urgent messages: a "Tornado Emergency" outranks an
 * ordinary warning and must never be filtered out as unrecognised.
 */
const PATTERNS: { severity: AlertSeverity; test: RegExp }[] = [
  { severity: "warning", test: /\b(warning|emergency)\b/i },
  { severity: "watch", test: /\bwatch\b/i },
  { severity: "advisory", test: /\b(advisory|advisories)\b/i },
  { severity: "statement", test: /\b(statement|outlook|forecast)\b/i },
];

/**
 * Unrecognised wording is treated as a warning, not as a statement.
 *
 * This is the deliberate direction to fail in. Over-reporting an unknown event
 * shows a red banner that turns out to be mild; under-reporting hides a real
 * hazard. Only the first is recoverable.
 */
const UNKNOWN: AlertSeverity = "warning";

export function alertSeverity(event: string | undefined | null): AlertSeverity {
  if (!event) return UNKNOWN;

  for (const { severity, test } of PATTERNS) {
    if (test.test(event)) return severity;
  }

  return UNKNOWN;
}

/** Highest severity first, then soonest expiry, so the banner shows the worst. */
export function compareBySeverity(
  a: { event: string; expires: number | null },
  b: { event: string; expires: number | null },
): number {
  const diff =
    SEVERITY_RANK[alertSeverity(b.event)] - SEVERITY_RANK[alertSeverity(a.event)];

  if (diff !== 0) return diff;

  return (a.expires ?? Number.MAX_SAFE_INTEGER) - (b.expires ?? Number.MAX_SAFE_INTEGER);
}

/**
 * Watch and above only. Advisories and statements stay in the app.
 *
 * A push is an interruption that can wake someone up. A frost advisory does not
 * earn that; a tornado warning does.
 */
export function isPushWorthy(event: string | undefined | null): boolean {
  return SEVERITY_RANK[alertSeverity(event)] >= SEVERITY_RANK.watch;
}
