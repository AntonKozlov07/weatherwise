import { headers } from "next/headers";

import { FONT_SIZES, STORAGE_KEY } from "@/lib/preferences";

/**
 * Applies the stored theme and font size before first paint.
 *
 * Without this, the page renders at Dark and 16px, then React hydrates and
 * snaps to Midnight or Large. On an installed PWA that flash happens on every
 * cold launch, which is exactly when it is most noticeable.
 *
 * Kept deliberately small and defensive: it runs before anything else, so a
 * throw here would take the whole page with it.
 */
export async function ThemeScript() {
  // Set per request by middleware.ts. Absent only if this ever renders outside
  // the middleware's matcher, in which case the script is simply omitted rather
  // than emitted and blocked.
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  // The font size goes in a stylesheet rather than an inline style on <html>.
  // Setting the style attribute makes the pre-hydration DOM differ from the
  // server HTML, which React reports as a hydration mismatch on every load.
  const script = `
(function () {
  try {
    var stored = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || "{}");
    var sizes = ${JSON.stringify(FONT_SIZES)};
    var root = document.documentElement;
    if (stored.theme === "midnight") root.dataset.theme = "midnight";
    var size = sizes[stored.fontSize];
    if (size) {
      var style = document.createElement("style");
      style.id = "ww-font-size";
      style.textContent = ":root{--app-font-size:" + size + "}";
      document.head.appendChild(style);
    }
  } catch (e) {}
})();
`.trim();

  // Without the nonce this is blocked by the policy in middleware.ts, and the
  // stored theme and font size are not applied until React hydrates, which is
  // exactly the flash of the wrong appearance this script exists to prevent.
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />;
}
