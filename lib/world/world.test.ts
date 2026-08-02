import { describe, expect, it } from "vitest";

import { formatTime } from "@/lib/format";
import { conditionLabelFor } from "@/lib/weather/openweather/conditions";

/**
 * The offset bug, pinned.
 *
 * Open-Meteo returns a local wall clock under `timezone=auto` with no offset on
 * it. Parsing it with a Z appended produces an instant wrong by the city's
 * offset, and formatting that instant back into the city's zone shifts it a
 * second time. Tokyo displayed 5pm when it was 8am (Decisions Log 108).
 *
 * The arithmetic is duplicated here rather than imported because the fetch it
 * lives inside cannot run without a network. What is being locked down is the
 * relationship between the three fields, which is where the mistake was.
 */
function observedAt(localTime: string, utcOffsetSeconds: number): number {
  return Date.parse(`${localTime}Z`) - utcOffsetSeconds * 1000;
}

describe("world snapshot timestamps", () => {
  it("renders the city's own clock back exactly as reported", () => {
    // Tokyo, nine hours ahead.
    const at = observedAt("2026-08-01T08:00", 9 * 3600);

    expect(formatTime(at, "Asia/Tokyo")).toBe("8:00 AM");
  });

  it("holds for a city behind UTC", () => {
    // New York, four hours behind in summer.
    const at = observedAt("2026-08-01T19:00", -4 * 3600);

    expect(formatTime(at, "America/New_York")).toBe("7:00 PM");
  });

  it("holds at UTC itself, where the bug would be invisible", () => {
    const at = observedAt("2026-08-01T12:00", 0);

    expect(formatTime(at, "UTC")).toBe("12:00 PM");
  });

  /**
   * The failing case as it was: treating the wall clock as UTC. Kept as a
   * demonstration that the two differ, so a future simplification back to
   * `Date.parse(time + "Z")` fails here rather than on a phone.
   */
  it("differs from the naive parse by exactly the offset", () => {
    const naive = Date.parse("2026-08-01T08:00Z");
    const correct = observedAt("2026-08-01T08:00", 9 * 3600);

    expect(naive - correct).toBe(9 * 3600 * 1000);
    expect(formatTime(naive, "Asia/Tokyo")).toBe("5:00 PM");
    expect(formatTime(correct, "Asia/Tokyo")).toBe("8:00 AM");
  });
});

/**
 * The comparison keys hours by local clock, and Open-Meteo writes midnight as
 * "T00". A locale whose 24-hour format renders midnight as 24 would silently
 * drop every midnight hour from the comparison rather than fail, so the
 * formatter's behaviour is pinned here.
 */
describe("hour keys at midnight", () => {
  it("formats midnight as 00, matching the vendor", () => {
    const hour = (time: number) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Toronto",
        hour: "2-digit",
        hour12: false,
      })
        .formatToParts(time)
        .find((part) => part.type === "hour")?.value;

    // 04:30 UTC is midnight in Toronto in summer.
    expect(hour(Date.parse("2026-08-01T04:30Z"))).toBe("00");
    expect(hour(Date.parse("2026-08-01T16:30Z"))).toBe("12");
  });
});

/**
 * The icons already switch to a night variant, so a clear night rendered a moon
 * captioned "Mostly Sunny". Only one label in the table names the sun, which is
 * why it went unnoticed: it is also one of the most common conditions there is
 * (Decisions Log 109).
 */
describe("condition labels after dark", () => {
  it("does not call a clear night sunny", () => {
    expect(conditionLabelFor(801, true)).toBe("Mostly Sunny");
    expect(conditionLabelFor(801, false)).toBe("Mostly Clear");
  });

  it("leaves labels that do not name the sun alone", () => {
    for (const code of [800, 802, 803, 804, 500, 601, 741, 200]) {
      expect(conditionLabelFor(code, false)).toBe(conditionLabelFor(code, true));
    }
  });
});
