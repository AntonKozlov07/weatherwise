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
export function ThemeScript() {
  const script = `
(function () {
  try {
    var stored = JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) || "{}");
    var sizes = ${JSON.stringify(FONT_SIZES)};
    var root = document.documentElement;
    if (stored.theme === "midnight") root.dataset.theme = "midnight";
    if (sizes[stored.fontSize]) root.style.setProperty("--app-font-size", sizes[stored.fontSize]);
  } catch (e) {}
})();
`.trim();

  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
