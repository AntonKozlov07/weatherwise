import { formatTemperature, temperatureUnit, type Units } from "@/lib/format";

/**
 * A temperature with its degree mark.
 *
 * The mark is a separate span at 45% size, raised toward the cap height, rather
 * than a literal ° in the string: at the hero's size a full-size degree sign is
 * a blob, and at the timeline's size an unstyled one sits on the baseline and
 * looks like a typo.
 *
 * This markup previously lived inside the now card and the forecast rail, both
 * of which the timeline replaced. Extracted rather than re-inlined, so there is
 * one place a temperature is drawn.
 */
export function Temperature({
  celsius,
  units,
  /** The C or F suffix. Off by default; only the hero is big enough to want it. */
  withUnit = false,
  className,
}: {
  celsius: number;
  units: Units;
  withUnit?: boolean;
  className?: string;
}) {
  return (
    <span className={className}>
      {formatTemperature(celsius, units)}
      <span className="type-degree" aria-hidden="true">
        °{withUnit ? temperatureUnit(units) : ""}
      </span>
      {/* Screen readers get the word, not a symbol that reads as "degree sign". */}
      <span className="sr-only">
        {" "}
        degrees{withUnit ? (units === "metric" ? " Celsius" : " Fahrenheit") : ""}
      </span>
    </span>
  );
}
