"use client";

/** Small shared controls, so settings and onboarding stay consistent. */

export function PrimaryButton({
  children,
  disabled,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="ww-press w-full rounded-pill bg-accent px-6 py-4 text-base font-medium text-white disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export function GhostButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ww-press rounded-pill border border-hairline px-5 py-3 text-sm"
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="type-label text-xs">{label}</span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        className="selectable rounded-inner border border-hairline bg-surface px-4 py-3 text-base outline-none focus:border-accent"
      />
    </label>
  );
}

/** Two or three mutually exclusive options, as a real radio group. */
export function OptionGroup<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string;
  hint?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="type-label text-xs">{label}</legend>
      {hint && <p className="mb-1 text-sm text-text-dim">{hint}</p>}

      <div className="flex gap-2 rounded-pill bg-surface p-1">
        {options.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(option.value)}
              className={`ww-press flex-1 rounded-pill px-3 py-2.5 text-sm ${
                selected ? "bg-surface-raised text-text" : "text-text-dim"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-base">{label}</p>
        {hint && <p className="mt-1 text-sm text-text-dim">{hint}</p>}
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`ww-press relative h-7 w-12 shrink-0 rounded-pill transition-colors ${
          checked ? "bg-accent" : "bg-surface-raised"
        }`}
      >
        {/* Positioned with `left`, not a transform. A transform is a percentage
            of the knob, which put it outside the track at the on position. */}
        <span
          className="absolute top-1 h-5 w-5 rounded-pill bg-white transition-[left] duration-200"
          style={{ left: checked ? "1.5rem" : "0.25rem" }}
        />
      </button>
    </div>
  );
}
