import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The header is a free advert for the stack running the site.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          /* The Content Security Policy is set in middleware.ts, because it
             carries a per-request nonce. */
          // Nothing here needs a camera, a microphone, or a payment sheet.
          // Geolocation is absent too: locations are searched, never sensed.
          {
            key: "Permissions-Policy",
            value: [
              "accelerometer=(self)",
              "gyroscope=(self)",
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "payment=()",
              "usb=()",
              "interest-cohort=()",
            ].join(", "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        // The worker script itself must never be cached, or a bad version can
        // pin itself in place. See the versioning note in public/sw.js.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
