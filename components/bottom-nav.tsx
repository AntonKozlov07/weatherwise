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
      className="sticky bottom-0 mt-auto px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3"
    >
      <ul className="flex items-center justify-around rounded-card bg-surface py-4">
        {ITEMS.map((item) => {
          const active = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-center rounded-inner p-2 ${
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
