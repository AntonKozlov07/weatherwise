"use client";

export type RailMode = "hourly" | "weekly";

type Props = {
  value: RailMode;
  onChange: (value: RailMode) => void;
};

const OPTIONS: { value: RailMode; label: string }[] = [
  { value: "hourly", label: "Hourly" },
  { value: "weekly", label: "Weekly" },
];

/**
 * Swaps what the rail below shows.
 *
 * This is the element that replaces the Figma's arrow-flanked hourly strip. It
 * reads as an underline rather than a filled pill: a pill would be a second
 * heavy surface stacked directly above the cards, which is the thing the strip
 * was removed to avoid.
 *
 * Built as a tablist, so the arrow keys move between the options the way a
 * native segmented control does.
 */
export function SegmentedControl({ value, onChange }: Props) {
  const index = OPTIONS.findIndex((option) => option.value === value);

  return (
    <div
      role="tablist"
      aria-label="Forecast range"
      className="relative mx-5"
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onChange(value === "hourly" ? "weekly" : "hourly");
      }}
    >
      <div className="flex">
        {OPTIONS.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="tab"
              id={`rail-tab-${option.value}`}
              aria-selected={selected}
              aria-controls="forecast-rail"
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(option.value)}
              className={`flex-1 pb-3 text-base transition-colors duration-200 ${
                selected ? "text-text" : "text-text-dim"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* Rule under both, with the active span brightened over it. */}
      <div className="h-px w-full bg-hairline" />

      <div
        aria-hidden="true"
        className="absolute bottom-0 h-0.5 rounded-pill bg-accent transition-transform duration-300 ease-out"
        style={{
          width: `${100 / OPTIONS.length}%`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
    </div>
  );
}
