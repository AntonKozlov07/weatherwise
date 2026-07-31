"use client";

import { useEffect } from "react";

import { conditionTheme, themeVariables } from "@/lib/theme/condition-theme";
import type { CurrentConditions, Astronomy } from "@/lib/weather/types";

type Props = {
  current: CurrentConditions | null;
  astronomy: Astronomy | null;
};

/**
 * Applies the condition theme to the document root.
 *
 * Custom properties on `:root` rather than props, so every screen inherits and
 * the whole app crossfades as one when the location changes. The transition
 * itself is declared in globals.css on `:root`.
 *
 * Renders nothing. It exists purely for the effect, which keeps the theming out
 * of the component tree entirely.
 */
export function ConditionThemeProvider({ current, astronomy }: Props) {
  useEffect(() => {
    const root = document.documentElement;

    if (!current) return;

    const theme = conditionTheme(
      current.condition.code,
      current.observedAt,
      astronomy?.sunrise ?? null,
      astronomy?.sunset ?? null,
    );

    const variables = themeVariables(theme);

    for (const [name, value] of Object.entries(variables)) {
      root.style.setProperty(name, value);
    }

    // Exposed for styling hooks and for debugging what the app decided.
    root.dataset.timeOfDay = theme.timeOfDay;
    root.dataset.condition = theme.condition;

    return () => {
      // Cleared on unmount so a screen without weather data falls back to the
      // static token palette rather than keeping a stale sky.
      for (const name of Object.keys(variables)) {
        root.style.removeProperty(name);
      }
      delete root.dataset.timeOfDay;
      delete root.dataset.condition;
    };
  }, [current, astronomy]);

  return null;
}
