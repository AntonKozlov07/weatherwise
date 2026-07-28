import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GradientTuner } from "./gradient-tuner";

export const metadata: Metadata = { title: "Gradient" };

/**
 * Tuning surface for the greeting gradient. Development only: the app ships
 * three screens and this is not one of them, so it 404s in production rather
 * than sitting there as a reachable route.
 */
export default function GradientDevPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return <GradientTuner />;
}
