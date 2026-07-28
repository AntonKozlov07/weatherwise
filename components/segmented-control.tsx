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
 * Swaps what the rail below shows. Built as a tablist so the arrow keys move
 * between the two options the way a native segmented control does.
 */
export function SegmentedControl({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Forecast range"
      className="mx-5 flex rounded-pill bg-surface p-1"
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        onChange(value === "hourly" ? "weekly" : "hourly");
      }}
    >
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
            // Title case, matching how CLAUDE.md writes the control, rather
            // than `.type-label`'s uppercase caption treatment.
            className={`flex-1 rounded-pill px-4 py-2 text-sm font-medium tracking-wide ${
              selected ? "bg-surface-raised text-text" : "text-text-dim"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
