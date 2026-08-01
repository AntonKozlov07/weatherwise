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

// v3: the brand SVGs were re-cropped. Their URLs are stable, so a cache-first
// entry kept serving the old artwork on every device that had already visited.
const CACHE_VERSION = "v17";
const SHELL_CACHE = `weatherwise-shell-${CACHE_VERSION}`;
const DATA_CACHE = `weatherwise-data-${CACHE_VERSION}`;

/** Offline fallback document plus the assets needed to render it. */
const SHELL_ASSETS = [
  "/",
  "/brand/WeatherWise_Text_Logo.svg",
  "/brand/Logo_Larger_Version.svg",
  "/icons/apple-icon-180.png",
];

/**
 * Content-hashed by the build, so a change means a new URL. Safe to serve
 * cache-first and never revalidate.
 */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

/**
 * Stable URLs whose contents can still change between releases: brand artwork,
 * generated icons, weather glyphs. Serving these cache-first meant editing an
 * SVG had no effect on any device that had already loaded it, which is exactly
 * what happened to the wordmark. They are now stale-while-revalidate: instant
 * from cache, but refreshed in the background for next time.
 */
function isRevalidatingAsset(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/") ||
    url.pathname.startsWith("/weather-icons/")
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
            .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
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

/**
 * Severe weather push.
 *
 * The payload is built server-side in lib/push/send.ts. A malformed one still
 * shows something rather than nothing: a push that arrives and displays no
 * notification is a permission violation in some browsers.
 */
self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "Severe weather alert";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "Tap for details.",
      icon: payload.icon || "/icons/manifest-icon-192.maskable.png",
      badge: payload.badge || "/icons/manifest-icon-192.maskable.png",
      // Tagged by alert id, so the same warning replaces rather than stacks.
      tag: payload.tag,
      data: payload.data || {},
      requireInteraction: false,
    }),
  );
});

/**
 * Focus an open window rather than opening a second one.
 *
 * `clients.matchAll` with `includeUncontrolled` catches a window that loaded
 * before this worker took over, which is the common case right after an update.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const target =
    data.latitude !== undefined && data.longitude !== undefined
      ? `/?lat=${data.latitude}&lon=${data.longitude}`
      : "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if (new URL(client.url).origin !== self.location.origin) continue;

        await client.focus();
        // Navigate the existing window instead of opening another one.
        if ("navigate" in client) await client.navigate(target);
        return;
      }

      await self.clients.openWindow(target);
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The last successful forecast, kept so the app has something to show with no
  // network. The response is stamped with the time it was stored, which is what
  // the "Offline, showing last update" banner reads.
  if (url.pathname === "/api/forecast") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();

            caches.open(DATA_CACHE).then(async (cache) => {
              const body = await copy.blob();
              const headers = new Headers(copy.headers);
              headers.set("x-weatherwise-cached-at", String(Date.now()));
              cache.put(request, new Response(body, { headers }));
            });
          }

          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: DATA_CACHE });

          if (cached) return cached;

          // No network and nothing stored. A structured error keeps the client
          // on its normal error path rather than a fetch rejection.
          return Response.json(
            {
              error: {
                kind: "upstream",
                message: "No connection, and no saved forecast yet.",
              },
            },
            { status: 503 },
          );
        }),
    );
    return;
  }

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

  if (isImmutableAsset(url)) {
    // Content-hashed: cache first, populate on miss, never revalidate.
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;

        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (isRevalidatingAsset(url)) {
    // Stale-while-revalidate: answer from cache immediately, then refresh it so
    // an edited asset reaches the device on the following load.
    event.respondWith(
      caches.open(SHELL_CACHE).then(async (cache) => {
        const cached = await cache.match(request);

        const refresh = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => null);

        if (cached) {
          event.waitUntil(refresh);
          return cached;
        }

        const response = await refresh;
        return response ?? Response.error();
      }),
    );
  }
});
