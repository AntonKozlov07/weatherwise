"use client";

/**
 * Haptics.
 *
 * Three intensities, mapped onto whatever the platform actually offers:
 *
 *   Android and desktop Chrome  `navigator.vibrate`, which is the real API.
 *   iOS Safari                  a hidden switch-style checkbox, toggled.
 *   Anything else               nothing at all, silently.
 *
 * The iOS path needs explaining, because it looks like nonsense otherwise.
 * Safari has never shipped the Vibration API, so `navigator.vibrate` is absent
 * on the one device this app is built for. What Safari does have is a haptic
 * tick when an `<input type="checkbox" switch>` is toggled, which is a side
 * effect of the control rather than an API. Toggling a hidden one is the only
 * way to produce feedback on iOS from the web today.
 *
 * That makes it fragile, and it is treated as such: it is an enhancement that
 * is allowed to fail. Nothing in the app checks whether it worked, nothing
 * changes if it did not, and if Apple removes the behaviour the app is exactly
 * as it was before (Decisions Log 78).
 *
 * Haptics must fire from inside a user gesture. Called from an effect or a
 * timer they are ignored on every platform, so every call site here is an
 * event handler.
 */

export type Haptic =
  /** A detent: scrubber steps, tab changes, list selection. */
  | "select"
  /** A thing opening or closing. */
  | "impact"
  /** A completed action, like a refresh landing. */
  | "success";

/**
 * Durations in milliseconds. Short, because a long buzz reads as an error on
 * every platform, and Android's motor is far blunter than Apple's.
 */
const PATTERN: Record<Haptic, number | number[]> = {
  select: 8,
  impact: 18,
  success: [12, 40, 12],
};

let enabled = true;
let switchInput: HTMLInputElement | null = null;

/** Mirrors the user's preference. Read on every call, so the toggle is live. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

function canVibrate(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

/**
 * The hidden control, created once on first use.
 *
 * Not `display: none` and not `hidden`: a control that is not rendered is not
 * interactive, and an inert checkbox produces no feedback. It is present and
 * laid out, just invisible and untouchable.
 */
function iosSwitch(): HTMLInputElement | null {
  if (typeof document === "undefined") return null;
  if (switchInput?.isConnected) return switchInput;

  const input = document.createElement("input");
  input.type = "checkbox";
  input.setAttribute("switch", "");
  input.ariaHidden = "true";
  input.tabIndex = -1;
  input.style.cssText = [
    "position:fixed",
    "top:0",
    "left:0",
    "width:1px",
    "height:1px",
    "opacity:0",
    "pointer-events:none",
    "z-index:-1",
  ].join(";");

  document.body.appendChild(input);
  switchInput = input;

  return input;
}

/**
 * Fires a haptic, or does nothing.
 *
 * Never throws and never reports failure. A call site should be able to ask for
 * feedback without caring whether the platform can give it, and without an
 * error path for something this inconsequential.
 */
export function haptic(kind: Haptic = "select"): void {
  if (!enabled) return;

  try {
    if (canVibrate()) {
      navigator.vibrate(PATTERN[kind]);
      return;
    }

    // iOS. The toggle itself is the effect; its state is meaningless, so it is
    // simply flipped each time rather than reset.
    const input = iosSwitch();
    if (input) input.click();
  } catch {
    // Deliberately swallowed. Haptics are decoration, and a platform quirk here
    // must never surface as an error in a weather app.
  }
}
