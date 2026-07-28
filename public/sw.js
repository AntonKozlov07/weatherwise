/**
 * WeatherWise service worker.
 *
 * Versioning strategy, so iOS never serves a stale shell forever:
 *
 *  1. `CACHE_VERSION` below is bumped whenever the cached shell changes. Cache
 *     names embed it, and `activate` deletes every cache that does not match.
 *  2. `/sw.js` is served with `Cache-Control: no-store` (see next.config.ts) and
 *     registered with `updateViaCache: 'none'`, so Safari always revalidates the
 *     worker script itself rather than reusing an HTTP-cached copy.
 *  3. `skipWaiting()` plus `clients.claim()` means a new worker takes over on the
 *     next load rather than waiting for every tab to close. Installed PWAs are
 *     rarely fully closed on iOS, so waiting is effectively forever.
 *
 * Phase 1 caches the app shell only. Forecast payload caching and the
 * "Offline, showing last update" banner land in phase 8.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `weatherwise-shell-${CACHE_VERSION}`;

/** Offline fallback document plus the assets needed to render it. */
const SHELL_ASSETS = [
  "/",
  "/brand/WeatherWise_Text_Logo.svg",
  "/brand/Logo_Larger_Version.svg",
  "/icons/apple-icon-180.png",
];

/** Paths that are safe to serve cache-first: content-hashed or immutable. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, fall back to the cached shell when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(request)) ?? (await cache.match("/"));
        }),
    );
    return;
  }

  if (!isStaticAsset(url)) return;

  // Static assets: cache first, populate on miss.
  event.respondWith(
    caches.open(SHELL_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) cache.put(request, response.clone());
      return response;
    }),
  );
});
