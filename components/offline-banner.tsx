"use client";

import { formatUpdatedAgo } from "@/lib/format";

/**
 * Shown when the forecast on screen came out of the service worker's cache
 * rather than the network, so stale numbers are never presented as current.
 */
export function OfflineBanner({ staleSince }: { staleSince: number }) {
  return (
    <p
      role="status"
      className="mx-5 rounded-inner border border-border bg-surface-raised px-4 py-2.5 text-sm text-text-dim"
    >
      Offline, showing last update ·{" "}
      {formatUpdatedAgo(staleSince).replace("Updated ", "")}
    </p>
  );
}
