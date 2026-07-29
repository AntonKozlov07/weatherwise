import type { Metadata } from "next";

import { MapClient } from "./map-client";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return <MapClient />;
}
