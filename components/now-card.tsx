import {
  formatLongDate,
  formatTemperature,
  formatWind,
  humidityLabel,
  temperatureUnit,
  type Units,
} from "@/lib/format";
import type { GradientStops } from "@/lib/gradient";
import type { CurrentConditions } from "@/lib/weather/types";

import { DropletIcon, RainChanceIcon, WindIcon } from "./metric-icons";
import { WeatherIcon } from "./weather-icon";

type Props = {
  current: CurrentConditions;
  timeZone: string;
  /** Highest precipitation chance in the coming hours, which "now" has none of. */
  precipitationChance: number;
  units?: Units;
  /** Tints the card edge from the same stops as the greeting. */
  gradient?: GradientStops;
};

function Row({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="shrink-0 text-text-dim" aria-hidden="true">
        {icon}
      </span>
      <span>{children}</span>
    </div>
  );
}

/**
 * The card that does not scroll. Everything here is current conditions; the
 * rail beside it is the only thing that moves.
 */
export function NowCard({
  current,
  timeZone,
  precipitationChance,
  units = "metric",
  gradient,
}: Props) {
  return (
    <section
      aria-label="Current conditions"
      className="card edge-gradient mx-5 rounded-card p-5"
      style={
        gradient
          ? ({
              "--edge-from": gradient.from,
              "--edge-to": gradient.to,
            } as React.CSSProperties)
          : undefined
      }
    >
      <p className="text-base text-text-dim">
        {formatLongDate(current.observedAt, timeZone)}
      </p>

      <div className="mt-3 flex items-start justify-between gap-4">
        <p className="type-temp text-[5.5rem]">
          {formatTemperature(current.temperature, units)}
          <span className="type-degree">°{temperatureUnit(units)}</span>
        </p>

        <div className="flex flex-col gap-3 pt-3">
          <Row icon={<WeatherIcon condition={current.condition} size={22} />}>
            {current.condition.text}
          </Row>
          <Row icon={<DropletIcon />}>{humidityLabel(current.humidity)}</Row>
          <Row icon={<WindIcon />}>
            {formatWind(current.wind.speed, units)}
          </Row>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-sm text-text-dim">
          Feels Like:{" "}
          <span className="type-numeric text-base text-text">
            {formatTemperature(current.feelsLike, units)}
            <span className="type-degree">°{temperatureUnit(units)}</span>
          </span>
        </p>

        <p className="flex items-center gap-2 text-sm text-text-dim">
          <RainChanceIcon size={20} />
          <span>
            {Math.round(precipitationChance)}% Chance of{" "}
            <span className="text-text">Rain</span>
          </span>
        </p>
      </div>
    </section>
  );
}
