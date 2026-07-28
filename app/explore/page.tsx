import type { Metadata } from "next";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <p className="type-label text-sm">Explore · Phase 6</p>
    </main>
  );
}
