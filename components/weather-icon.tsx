import Image from "next/image";

import { weatherIconSrc } from "@/lib/weather/icons";
import type { ConditionRef } from "@/lib/weather/types";

type Props = {
  condition: ConditionRef;
  size?: number;
  className?: string;
};

/**
 * Meteocons, served from our own origin. `unoptimized` because these are SVGs:
 * the image optimiser would only add a round trip.
 *
 * The condition text is the alt text, so a card reads as "3pm, Light rain, 14"
 * rather than announcing an image.
 */
export function WeatherIcon({ condition, size = 40, className }: Props) {
  return (
    <Image
      src={weatherIconSrc(condition)}
      alt={condition.label}
      width={size}
      height={size}
      className={className}
      unoptimized
    />
  );
}
