import type { Metadata } from "next";

import { About } from "./about";

export const metadata: Metadata = {
  title: "About · WeatherWise",
  description: "Privacy, data sources, and notices.",
};

export default function AboutPage() {
  return <About />;
}
