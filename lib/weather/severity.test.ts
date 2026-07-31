import { describe, expect, it } from "vitest";

import { alertSeverity, compareBySeverity, isPushWorthy } from "./severity";

describe("alertSeverity", () => {
  it("reads the four levels out of real event names", () => {
    expect(alertSeverity("Severe Thunderstorm Warning")).toBe("warning");
    expect(alertSeverity("Tornado Watch")).toBe("watch");
    expect(alertSeverity("Winter Weather Advisory")).toBe("advisory");
    expect(alertSeverity("Special Weather Statement")).toBe("statement");
  });

  it("is case insensitive", () => {
    expect(alertSeverity("FLOOD WARNING")).toBe("warning");
    expect(alertSeverity("frost advisory")).toBe("advisory");
  });

  // National services use "emergency" for their most urgent messages, and it
  // outranks an ordinary warning rather than falling through as unrecognised.
  it("treats an emergency as a warning", () => {
    expect(alertSeverity("Tornado Emergency")).toBe("warning");
  });

  // Matched most severe first, so a name carrying two keywords takes the worse.
  it("takes the highest level when a name contains several", () => {
    expect(alertSeverity("Severe Thunderstorm Watch Statement")).toBe("watch");
    expect(alertSeverity("Flood Warning and Watch")).toBe("warning");
  });

  /**
   * The direction of failure is deliberate. Over-reporting an unknown event
   * shows a red banner that turns out to be mild; under-reporting hides a real
   * hazard. Only the first is recoverable.
   */
  it("treats unrecognised wording as a warning, not a statement", () => {
    expect(alertSeverity("Tsunami")).toBe("warning");
    expect(alertSeverity("Rip Current")).toBe("warning");
    expect(alertSeverity("")).toBe("warning");
    expect(alertSeverity(undefined)).toBe("warning");
    expect(alertSeverity(null)).toBe("warning");
  });

  // "Watchful" is not a watch. Whole-word matching stops a substring promoting
  // an advisory into something that pushes a notification.
  it("matches whole words only", () => {
    expect(alertSeverity("Watchful Conditions Advisory")).toBe("advisory");
  });
});

describe("isPushWorthy", () => {
  it("pushes watches and warnings", () => {
    expect(isPushWorthy("Tornado Warning")).toBe(true);
    expect(isPushWorthy("Severe Thunderstorm Watch")).toBe(true);
  });

  // A push can wake someone up. A frost advisory has not earned that.
  it("does not push advisories or statements", () => {
    expect(isPushWorthy("Frost Advisory")).toBe(false);
    expect(isPushWorthy("Special Weather Statement")).toBe(false);
  });

  it("pushes unrecognised events, matching the fail-loud default", () => {
    expect(isPushWorthy("Tsunami")).toBe(true);
  });
});

describe("compareBySeverity", () => {
  const alert = (event: string, expires: number | null = null) => ({
    event,
    expires,
  });

  it("sorts the most severe first", () => {
    const sorted = [
      alert("Frost Advisory"),
      alert("Tornado Warning"),
      alert("Flood Watch"),
      alert("Special Weather Statement"),
    ].sort(compareBySeverity);

    expect(sorted.map((a) => a.event)).toEqual([
      "Tornado Warning",
      "Flood Watch",
      "Frost Advisory",
      "Special Weather Statement",
    ]);
  });

  it("breaks ties on the soonest expiry", () => {
    const sorted = [
      alert("Flood Warning", 3_000),
      alert("Wind Warning", 1_000),
    ].sort(compareBySeverity);

    expect(sorted.map((a) => a.event)).toEqual(["Wind Warning", "Flood Warning"]);
  });

  it("puts an alert with no expiry last among equals", () => {
    const sorted = [alert("A Warning", null), alert("B Warning", 500)].sort(
      compareBySeverity,
    );

    expect(sorted[0].event).toBe("B Warning");
  });
});
