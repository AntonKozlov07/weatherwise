"use client";

import { useState } from "react";

import { updatePreferences } from "@/components/preferences-provider";
import { GhostButton } from "@/components/ui";
import { updatePushRules } from "@/lib/push/client";
import {
  RULE_LABELS,
  RULE_UNITS,
  ruleDescription,
  type RuleKind,
  type ThresholdRule,
} from "@/lib/push/rules";
import type { Preferences } from "@/lib/preferences";

/**
 * Custom threshold rules.
 *
 * "Tell me when it drops below zero." Separate from the severe weather toggle
 * above it, and worded as a personal preference rather than a warning, because
 * these are not the same kind of thing and dressing one as the other would make
 * a real warning easier to ignore (Decisions Log 69).
 *
 * Rules live in preferences and are mirrored to the server, which is the only
 * place they can be evaluated: the phone is asleep when the weather changes.
 */

const KINDS: RuleKind[] = [
  "temp-below",
  "temp-above",
  "wind-above",
  "uv-above",
  "rain-starting",
  "frost-tonight",
];

/** Sensible starting points, so a new rule is useful before it is edited. */
const DEFAULT_VALUE: Record<RuleKind, number> = {
  "temp-below": 0,
  "temp-above": 30,
  "wind-above": 60,
  "uv-above": 7,
  "rain-starting": 0,
  "frost-tonight": 0,
};

export function AlertRules({ preferences }: { preferences: Preferences }) {
  const [adding, setAdding] = useState(false);
  const rules = preferences.alertRules;

  /**
   * Preferences first, server second. The local list is what the user sees, and
   * a failed network call must not make the row they just added vanish; the
   * next successful save carries the whole list anyway, so it self-heals.
   */
  const commit = (next: ThresholdRule[]) => {
    updatePreferences({ alertRules: next });
    void updatePushRules(next);
  };

  const add = (kind: RuleKind) => {
    setAdding(false);

    // One rule per kind. Two "below zero" rules would both fire and there is no
    // way to tell them apart on a lock screen.
    if (rules.some((rule) => rule.kind === kind)) return;

    commit([
      ...rules,
      { id: kind, kind, value: DEFAULT_VALUE[kind], enabled: true },
    ]);
  };

  const update = (id: string, patch: Partial<ThresholdRule>) => {
    commit(rules.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  };

  const remove = (id: string) => {
    commit(rules.filter((rule) => rule.id !== id));
  };

  const available = KINDS.filter((kind) => !rules.some((rule) => rule.kind === kind));

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm">My alerts</p>
        <p className="mt-1 text-xs text-text-dim">
          Sent once when the condition starts, not while it lasts.
        </p>
      </div>

      {rules.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rules.map((rule) => (
            <li
              key={rule.id}
              className="flex items-center gap-3 rounded-inner bg-surface px-4 py-3"
            >
              <label className="flex min-w-0 flex-1 items-center gap-3">
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={(event) =>
                    update(rule.id, { enabled: event.target.checked })
                  }
                  className="size-4 shrink-0 accent-[color:var(--accent)]"
                />
                <span className="min-w-0 truncate text-xs">
                  {RULE_UNITS[rule.kind] === undefined
                    ? ruleDescription(rule)
                    : RULE_LABELS[rule.kind]}
                </span>
              </label>

              {/* Only the rules that compare against a number get a number. */}
              {RULE_UNITS[rule.kind] !== undefined && (
                <span className="flex shrink-0 items-center gap-1">
                  <input
                    type="number"
                    inputMode="numeric"
                    value={rule.value}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isFinite(value)) update(rule.id, { value });
                    }}
                    aria-label={RULE_LABELS[rule.kind]}
                    className="w-14 rounded-[6px] bg-bg px-2 py-1 text-right text-xs tabular-nums"
                  />
                  <span className="text-2xs text-text-faint">
                    {RULE_UNITS[rule.kind]}
                  </span>
                </span>
              )}

              <button
                type="button"
                onClick={() => remove(rule.id)}
                aria-label={`Remove: ${ruleDescription(rule)}`}
                className="shrink-0 text-2xs text-text-faint"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <ul className="flex flex-col gap-2">
          {available.map((kind) => (
            <li key={kind}>
              <button
                type="button"
                onClick={() => add(kind)}
                className="w-full rounded-inner bg-surface px-4 py-3 text-left text-xs"
              >
                {RULE_LABELS[kind]}
              </button>
            </li>
          ))}
          <li>
            <GhostButton onClick={() => setAdding(false)}>Cancel</GhostButton>
          </li>
        </ul>
      ) : (
        available.length > 0 && (
          <GhostButton onClick={() => setAdding(true)}>Add an alert</GhostButton>
        )
      )}
    </div>
  );
}
