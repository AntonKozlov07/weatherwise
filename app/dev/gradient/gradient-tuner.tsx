"use client";

import { useMemo, useState } from "react";

import {
  CONDITION_BUCKETS,
  SAMPLE_CODE,
  type ConditionBucket,
} from "@/lib/gradient/conditions";
import { getGreetingGradient } from "@/lib/gradient";
import { resolveWindow } from "@/lib/gradient/windows";

const DAY_START = Date.UTC(2026, 6, 28);
const MINUTE = 60_000;

function clock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function greeting(minutes: number): string {
  if (minutes < 12 * 60) return "Good Morning";
  if (minutes < 17 * 60) return "Good Afternoon";
  return "Good Evening";
}

type SliderProps = {
  label: string;
  value: number;
  max: number;
  onChange: (value: number) => void;
};

function Slider({ label, value, max, onChange }: SliderProps) {
  return (
    <label className="flex flex-col gap-2">
      <span className="type-label flex justify-between text-xs">
        <span>{label}</span>
        <span className="tabular-nums">{clock(value)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-accent"
      />
    </label>
  );
}

export function GradientTuner() {
  const [nowMinutes, setNowMinutes] = useState(14 * 60);
  const [sunriseMinutes, setSunriseMinutes] = useState(6 * 60);
  const [sunsetMinutes, setSunsetMinutes] = useState(21 * 60);
  const [bucket, setBucket] = useState<ConditionBucket>("clear");

  const { gradient, position } = useMemo(() => {
    const now = new Date(DAY_START + nowMinutes * MINUTE);
    const sunrise = new Date(DAY_START + sunriseMinutes * MINUTE);
    const sunset = new Date(DAY_START + sunsetMinutes * MINUTE);

    return {
      gradient: getGreetingGradient(now, sunrise, sunset, SAMPLE_CODE[bucket]),
      position: resolveWindow(
        now.getTime(),
        sunrise.getTime(),
        sunset.getTime(),
      ),
    };
  }, [nowMinutes, sunriseMinutes, sunsetMinutes, bucket]);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-6 py-10">
      <h1 className="type-label text-xs">Gradient tuning</h1>

      <p
        className="type-heading text-3xl leading-tight"
        style={{
          backgroundImage: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
          backgroundClip: "text",
          WebkitBackgroundClip: "text",
          color: "transparent",
        }}
      >
        {greeting(nowMinutes)} Anton!
      </p>

      <div
        className="h-16 rounded-inner border border-hairline"
        style={{
          backgroundImage: `linear-gradient(90deg, ${gradient.from}, ${gradient.to})`,
        }}
      />

      <dl className="grid grid-cols-2 gap-y-2 text-sm">
        <dt className="type-label text-xs">Window</dt>
        <dd className="type-numeric">{position.window}</dd>
        <dt className="type-label text-xs">Blending to</dt>
        <dd className="type-numeric">{position.next}</dd>
        <dt className="type-label text-xs">Fraction</dt>
        <dd className="type-numeric tabular-nums">
          {position.fraction.toFixed(3)}
        </dd>
        <dt className="type-label text-xs">From</dt>
        <dd className="type-numeric tabular-nums">{gradient.from}</dd>
        <dt className="type-label text-xs">To</dt>
        <dd className="type-numeric tabular-nums">{gradient.to}</dd>
      </dl>

      <div className="flex flex-col gap-5">
        <Slider
          label="Time of day"
          value={nowMinutes}
          max={24 * 60 - 1}
          onChange={setNowMinutes}
        />
        <Slider
          label="Sunrise"
          value={sunriseMinutes}
          max={24 * 60 - 1}
          onChange={setSunriseMinutes}
        />
        <Slider
          label="Sunset"
          value={sunsetMinutes}
          max={24 * 60 - 1}
          onChange={setSunsetMinutes}
        />
      </div>

      <fieldset className="flex flex-wrap gap-2">
        <legend className="type-label mb-2 text-xs">Condition</legend>
        {CONDITION_BUCKETS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => setBucket(candidate)}
            aria-pressed={candidate === bucket}
            className={`rounded-pill border px-3 py-1 text-sm ${
              candidate === bucket
                ? "border-accent bg-surface-raised text-text"
                : "border-hairline text-text-dim"
            }`}
          >
            {candidate}
          </button>
        ))}
      </fieldset>
    </main>
  );
}
