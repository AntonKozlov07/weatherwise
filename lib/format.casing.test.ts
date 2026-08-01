import { describe, expect, it } from "vitest";
import { formatDayShort, formatHour, formatTime, formatTimeRounded } from "@/lib/format";

const TZ = "America/Toronto";
const EVENING = Date.UTC(2026, 6, 29, 0, 41);
const MORNING = Date.UTC(2026, 6, 28, 10, 5);

describe("time casing", () => {
  it("renders the meridiem fully capitalised with no stops", () => {
    expect(formatTime(EVENING, TZ)).toBe("8:41 PM");
    expect(formatTime(MORNING, TZ)).toBe("6:05 AM");
  });

  it("keeps it capitalised after rounding", () => {
    expect(formatTimeRounded(EVENING, TZ)).toBe("8:40 PM");
  });

  it("never emits a lowercase or dotted meridiem", () => {
    for (const offset of [0, 3, 7, 11, 12, 13, 18, 23]) {
      const at = MORNING + offset * 3_600_000;
      expect(formatTime(at, TZ)).not.toMatch(/\.|[ap]m/);
      expect(formatTime(at, TZ)).toMatch(/ (AM|PM)$/);
    }
  });

  /**
   * Left lower case on purpose. Every label showing this sits inside
   * .type-label, which capitalises it to 8PM; the remaining call sites are
   * sentences, where "8pm" is correct.
   */
  it("leaves the compact hour to the label style", () => {
    expect(formatHour(EVENING, TZ)).toBe("8pm");
  });

  /**
   * Slicing the full name to three characters rendered "Today" as "Tod" on a
   * day row, which is what this replaced.
   */
  it("abbreviates a weekday without truncating Today", () => {
    const nextWeek = MORNING + 3 * 24 * 3_600_000;

    expect(formatDayShort(EVENING, TZ, MORNING)).toBe("Today");
    expect(formatDayShort(nextWeek, TZ, MORNING)).toBe("Fri");
    expect(formatDayShort(nextWeek, TZ, MORNING)).toHaveLength(3);
  });
});
