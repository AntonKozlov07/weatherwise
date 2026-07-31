import { NextResponse, type NextRequest } from "next/server";

/**
 * Content Security Policy, with a per-request nonce.
 *
 * The policy lived in next.config.ts as `script-src 'self'`, and it broke the
 * entire app: Next streams its hydration payload as inline script tags, and the
 * theme bootstrap is inline too, so a policy that forbids inline scripts stops
 * React ever hydrating. The page rendered its markup and then did nothing at
 * all. It was caught by loading a production build and finding no hydration
 * rather than by reading the policy, which looked perfectly sensible
 * (Decisions Log 86).
 *
 * A nonce is the fix that keeps the protection. Next reads it from the request
 * header and stamps it on the scripts it emits; `theme-script.tsx` takes the
 * same value. `strict-dynamic` then lets those trusted scripts load the app's
 * own chunks without every URL needing to be listed.
 *
 * The cost is that every route is rendered per request rather than prerendered,
 * because the nonce differs each time. That is acceptable here: the content is
 * fetched on the client anyway, and the service worker is what makes the shell
 * fast, not static generation.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  const policy = [
    "default-src 'self'",
    // strict-dynamic: trust flows from the nonced bootstrap to the chunks it
    // loads. `'self'` is kept for browsers that do not support it.
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'self' https:`,
    // Inline styles cannot carry a nonce when they are style attributes, and
    // the condition theme sets custom properties that way at runtime.
    "style-src 'self' 'unsafe-inline'",
    // News thumbnails come from arbitrary publisher domains; everything else is
    // same origin or a data URI.
    // Publisher thumbnails on Explore come from arbitrary news domains, which
    // cannot be enumerated. Images are the one place that is tolerable: they
    // cannot execute, and no data leaves with the request beyond the fetch.
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    /*
      The important one, and the reason this policy is worth having: every
      weather call goes through a route handler on this origin, so an injected
      script has nowhere to send a location to.
      
      The one exception is the basemap. MapLibre fetches raster tiles rather
      than loading them as images, so they are governed by connect-src, and
      CARTO has to be named or the map renders as a blank grid. Listed
      explicitly rather than opened to https:, which would defeat the point.
    */
    "connect-src 'self' https://*.basemaps.cartocdn.com",
    // MapLibre spawns its tile workers from blob URLs.
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ].join("; ");

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the service worker. Hashed build
     * output is immutable and carries no scripts to police, and running this on
     * every tile request would be pure overhead.
     */
    {
      source: "/((?!_next/static|_next/image|favicon.ico|sw.js|brand|icons|weather-icons).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
