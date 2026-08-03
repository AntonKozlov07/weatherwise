import type { Metadata } from "next";

import { YourWeather } from "./your-weather";

export const metadata: Metadata = {
  title: "Your weather · WeatherWise",
  description: "What you like and dislike, and what to suggest.",
};

export default function YourWeatherPage() {
  return <YourWeather />;
}
