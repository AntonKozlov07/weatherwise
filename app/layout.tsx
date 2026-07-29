import type { Metadata, Viewport } from "next";
import { Albert_Sans } from "next/font/google";

import { PreferencesProvider } from "@/components/preferences-provider";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { ThemeScript } from "@/components/theme-script";
import { appleStartupImages } from "@/lib/pwa/splash-screens";
import "./globals.css";

const albertSans = Albert_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-albert-sans",
});

export const metadata: Metadata = {
  applicationName: "WeatherWise",
  title: {
    default: "WeatherWise",
    template: "%s | WeatherWise",
  },
  description: "Weather for where you are, read at a glance.",
  manifest: "/manifest.webmanifest",
  formatDetection: { telephone: false },
  icons: {
    // iOS does not reliably read the manifest for the home screen icon, so the
    // apple-touch-icon link has to be explicit.
    icon: [{ url: "/icons/favicon-196.png", sizes: "196x196", type: "image/png" }],
    apple: [{ url: "/icons/apple-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "WeatherWise",
    // Lets the page paint under the status bar, which viewport-fit=cover and
    // the safe area padding then account for.
    statusBarStyle: "black-translucent",
    startupImage: appleStartupImages,
  },
};

export const viewport: Viewport = {
  themeColor: "#1E2024",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${albertSans.variable} antialiased`}>
      <head>
        {/* Next emits only the unprefixed `mobile-web-app-capable`. Older iOS
            still keys standalone launch and the status bar style off the
            Apple-prefixed name, so it is set by hand. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <ThemeScript />
      </head>
      <body>
        <PreferencesProvider>
          <div className="app-shell">{children}</div>
        </PreferencesProvider>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

