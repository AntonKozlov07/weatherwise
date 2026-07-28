"use client";

import { useEffect } from "react";

/**
 * Registers the service worker in production only. Registering it in dev fights
 * with the Next dev server's own asset handling and produces confusing stale
 * reads, so local service worker testing goes through `npm run build && npm start`.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | undefined;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
      })
      .catch(() => {
        // A failed registration must not break the app. Offline support is the
        // only thing lost.
      });

    // An installed PWA on iOS is resumed far more often than it is launched, so
    // resuming is the moment to check for a newer worker.
    const checkForUpdate = () => {
      if (document.visibilityState === "visible") registration?.update();
    };

    document.addEventListener("visibilitychange", checkForUpdate);
    return () => document.removeEventListener("visibilitychange", checkForUpdate);
  }, []);

  return null;
}
