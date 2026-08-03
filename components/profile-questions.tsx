"use client";

import {
  ACTIVITY_LABELS,
  AVOIDANCE_LABELS,
  type ActivityId,
  type Avoidance,
  type Tolerance,
  type WeatherProfile,
} from "@/lib/profile/profile";

/**
 * The five questions.
 *
 * One component, used by both onboarding and the menu page, so the two cannot
 * drift into asking different things. Every question is skippable by simply not
 * answering: there is no required state and no validation, because an
 * unanswered question is a legitimate answer here (Decisions Log 117).
 */

type Props = {
  profile: WeatherProfile;
  onChange: (profile: WeatherProfile) => void;
};

const ACTIVITY_ORDER: ActivityId[] = [
  "running",
  "cycling",
  "walking",
  "hiking",
  "football",
  "tennis",
  "golf",
  "swimming",
  "gardening",
  "photography",
  "skiing",
];

const AVOID_ORDER: Avoidance[] = ["rain", "strong-sun", "grey", "sudden-changes"];

export function ProfileQuestions({ profile, onChange }: Props) {
  const toggle = <T,>(list: T[], value: T): T[] =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  return (
    <div className="flex flex-col gap-8">
      <Question
        number={1}
        title="What do you do outdoors?"
        hint="Pick any that apply. Suggestions come from this list only."
      >
        <Chips
          options={ACTIVITY_ORDER.map((id) => ({ id, label: ACTIVITY_LABELS[id] }))}
          selected={profile.activities}
          onToggle={(id) =>
            onChange({ ...profile, activities: toggle(profile.activities, id) })
          }
        />
      </Question>

      <Question number={2} title="Heat and cold" hint="However you actually feel it.">
        <div className="flex flex-col gap-3">
          <Scale
            label="Heat"
            value={profile.heat}
            onChange={(heat) => onChange({ ...profile, heat })}
            likeLabel="Love it"
            dislikeLabel="Hate it"
          />
          <Scale
            label="Cold"
            value={profile.cold}
            onChange={(cold) => onChange({ ...profile, cold })}
            likeLabel="Love it"
            dislikeLabel="Hate it"
          />
        </div>
      </Question>

      <Question number={3} title="Wind">
        <Scale
          label="Wind"
          value={profile.wind}
          onChange={(wind) => onChange({ ...profile, wind })}
          likeLabel="Don't mind"
          dislikeLabel="Don't like it"
          /* Nobody seeks out wind, so the positive end is indifference. */
          hideLike
        />
      </Question>

      <Question number={4} title="Humidity">
        <Scale
          label="Humidity"
          value={profile.humidity}
          onChange={(humidity) => onChange({ ...profile, humidity })}
          likeLabel="Don't mind"
          dislikeLabel="Don't like it"
          hideLike
        />
      </Question>

      <Question
        number={5}
        title="Anything else you would rather avoid?"
        hint="Only mentioned on days it actually applies."
      >
        <Chips
          options={AVOID_ORDER.map((id) => ({ id, label: AVOIDANCE_LABELS[id] }))}
          selected={profile.avoid}
          onToggle={(id) => onChange({ ...profile, avoid: toggle(profile.avoid, id) })}
        />
      </Question>
    </div>
  );
}

function Question({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <p className="type-label text-2xs">Question {number} of 5</p>
        <h2 className="mt-1 text-base">{title}</h2>
        {hint && <p className="mt-1 text-xs text-text-dim">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Chips<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { id: T; label: string }[];
  selected: T[];
  onToggle: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const on = selected.includes(option.id);

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            aria-pressed={on}
            className={`ww-press rounded-pill px-4 py-2 text-sm transition-colors ${
              on ? "bg-surface-raised text-text" : "bg-surface text-text-dim"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Three states, and tapping the chosen one again clears it back to neutral.
 * Without that there would be no way to undo an answer short of resetting
 * everything, and an answer given by accident is worse than none.
 */
function Scale({
  label,
  value,
  onChange,
  likeLabel,
  dislikeLabel,
  hideLike = false,
}: {
  label: string;
  value: Tolerance;
  onChange: (value: Tolerance) => void;
  likeLabel: string;
  dislikeLabel: string;
  hideLike?: boolean;
}) {
  const options: { id: Tolerance; label: string }[] = hideLike
    ? [
        { id: "neutral", label: likeLabel },
        { id: "dislike", label: dislikeLabel },
      ]
    : [
        { id: "like", label: likeLabel },
        { id: "neutral", label: "Fine" },
        { id: "dislike", label: dislikeLabel },
      ];

  return (
    <div className="flex items-center justify-between gap-3">
      <span className="type-label shrink-0 text-2xs">{label}</span>

      <div className="flex flex-wrap justify-end gap-2">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(value === option.id ? "neutral" : option.id)}
            aria-pressed={value === option.id}
            className={`ww-press rounded-pill px-3 py-1.5 text-sm transition-colors ${
              value === option.id
                ? "bg-surface-raised text-text"
                : "bg-surface text-text-dim"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
