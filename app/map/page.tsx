import type { Metadata } from "next";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <p className="type-label text-sm">Map · Phase 7</p>
    </main>
  );
}
