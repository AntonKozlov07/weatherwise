import type { Metadata } from "next";

import { BottomNav } from "@/components/bottom-nav";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex flex-col gap-3 px-5 pt-[calc(1.5rem+env(safe-area-inset-top))]">
        <h1 className="type-heading text-2xl">Settings</h1>
        <p className="type-label text-xs">Phase 5</p>
      </main>

      <BottomNav />
    </div>
  );
}
