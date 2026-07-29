import type { Metadata } from "next";

import { Explore } from "./explore";

export const metadata: Metadata = { title: "Explore" };

export default function ExplorePage() {
  return <Explore />;
}
