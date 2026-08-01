"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "Home",
    path: "M3 10.5 12 3l9 7.5M5.5 9.5V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5",
  },
  {
    href: "/explore",
    label: "Explore",
    path: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm3.5 5.5-2 5-5 2 2-5 5-2Z",
  },
  {
    href: "/map",
    label: "Map",
    path: "M9 4 3 6.5v13L9 17m0-13 6 2.5M9 4v13m6-10.5 6-2.5v13L15 20m0-13.5V20m-6-3 6 3",
  },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sections"
      // Pulled in 10px further on each side than the page gutter, and taller,
      // so the bar reads as a floating control rather than a full-width strip.
      //
      // No safe-area inset here. `.app-shell` already applies it, and adding it
      // again counted the home indicator twice, leaving a band of dead space
      // below the nav on any device that reports one (Decisions Log 47).
      // No bottom padding of its own either. The shell's safe-area inset is the
      // only gap left below the bar, which is the minimum that keeps a tappable
      // control clear of the home indicator. That remaining band cannot be
      // reclaimed for something interactive.
      /*
        The dock carries the bottom safe-area inset for the whole app. The shell
        no longer reserves it, so backgrounds reach the physical edge and this
        is the one element that has to sit clear of the home indicator.
      */
      className="ww-dock px-[1.875rem] pt-3"
    >
      <ul className="card-floating flex items-center justify-around rounded-card py-6">
        {ITEMS.map((item) => {
          const active = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`ww-press flex items-center justify-center rounded-inner p-2 transition-colors ${
                  active ? "text-text" : "text-text-dim"
                }`}
              >
                <svg
                  width="26"
                  height="26"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={item.path} />
                </svg>
                <span className="sr-only">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
