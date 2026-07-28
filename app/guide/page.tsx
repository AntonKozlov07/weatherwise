import type { Metadata } from "next";

import { BottomNav } from "@/components/bottom-nav";

export const metadata: Metadata = { title: "Guide" };

/** Copy is used as written in CLAUDE.md. Do not paraphrase it. */
export default function GuidePage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="selectable flex flex-col gap-5 px-5 pt-[calc(1.5rem+env(safe-area-inset-top))] pb-6">
        <h1 className="type-heading text-2xl">Reading WeatherWise</h1>

        <p className="text-[0.9375rem] leading-relaxed text-text-dim">
          The greeting at the top of the home screen changes colour through the
          day. It runs cool and blue before sunrise, warms through amber and gold
          by mid-morning, whitens at midday, and burns orange through golden hour
          before cooling to violet at dusk and grey overnight. It follows the
          actual sunrise and sunset where you are, so it drifts through the year.
        </p>

        <p className="text-[0.9375rem] leading-relaxed text-text-dim">
          Weather shifts it too. Rain pulls it toward slate blue, snow toward
          pale ice, overcast drains the colour out of it, and a thunderstorm
          pushes it violet. On a clear day you see the time of day undiluted.
        </p>

        <p className="text-[0.9375rem] leading-relaxed text-text-dim">
          <span className="text-text">The cards.</span> The large card stays put
          and always shows conditions right now. The row beside it scrolls.
          Switch it between Hourly and Weekly with the control above it.
        </p>

        <p className="text-[0.9375rem] leading-relaxed text-text-dim">
          <span className="text-text">UV index.</span> Below 3 is low. 3 to 7
          means cover up. Above 8, limit time outside around midday.
        </p>

        <p className="text-[0.9375rem] leading-relaxed text-text-dim">
          <span className="text-text">Air quality.</span> Below 50 is good. 51 to
          100 is acceptable. Above 100, people with asthma or heart conditions
          should take it easy outdoors.
        </p>

        <p className="text-[0.9375rem] leading-relaxed text-text-dim">
          <span className="text-text">Feels like</span> accounts for wind and
          humidity. Wind makes cold air feel colder. Humidity makes warm air feel
          warmer.
        </p>
      </main>

      <BottomNav />
    </div>
  );
}
