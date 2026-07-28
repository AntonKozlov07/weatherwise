import {
  formatLongDate,
  formatTemperature,
  formatWind,
  humidityLabel,
  temperatureUnit,
  type Units,
} from "@/lib/format";
import type { CurrentConditions } from "@/lib/weather/types";

import { WeatherIcon } from "./weather-icon";

type Props = {
  current: CurrentConditions;
  timeZone: string;
  /** Highest precipitation chance in the coming hours, which "now" has none of. */
  precipitationChance: number;
  units?: Units;
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
}: Props) {
  return (
    <section
      aria-label="Current conditions"
      className="mx-5 rounded-card bg-surface p-5"
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
          <Row
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
                <path d="M12 3.5 6.8 11a6 6 0 1 0 10.4 0L12 3.5Z" />
              </svg>
            }
          >
            {humidityLabel(current.humidity)}
          </Row>
          <Row
            icon={
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
                <path d="M3 9h11a3 3 0 1 0-3-3M3 14h14a3 3 0 1 1-3 3M3 11.5h7" />
              </svg>
            }
          >
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
            <path d="M7 16.5a4.5 4.5 0 0 1-.6-8.96 5.5 5.5 0 0 1 10.7-1.02A4 4 0 0 1 17.5 16.5H7Z" />
            <path d="M9 19.5 8 21m4-1.5-1 1.5m4-1.5-1 1.5" />
          </svg>
          <span>
            {Math.round(precipitationChance)}% Chance of{" "}
            <span className="text-text">Rain</span>
          </span>
        </p>
      </div>
    </section>
  );
}
