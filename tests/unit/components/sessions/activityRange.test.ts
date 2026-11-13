import { describe, it, expect } from "vitest";
import { eventMinutesInInclusiveRange } from "@/src/components/sessions/activityRange";

describe("sessions/activityRange", () => {
  describe("eventMinutesInInclusiveRange", () => {
    it("returns 0 when no overlap", () => {
      const ev = { date: "2025-02-01", start_minutes: 0, duration_minutes: 30 };
      expect(eventMinutesInInclusiveRange(ev, "2025-03-01", "2025-03-05")).toBe(0);
    });

    it("returns full duration when event fully inside range", () => {
      const ev = { date: "2025-02-01", start_minutes: 60, duration_minutes: 90 };
      expect(eventMinutesInInclusiveRange(ev, "2025-02-01", "2025-02-01")).toBe(90);
    });

    it("returns partial minutes when clipped by range", () => {
      const ev = { date: "2025-02-01", start_minutes: 23 * 60, duration_minutes: 120 };
      const mins = eventMinutesInInclusiveRange(ev, "2025-02-01", "2025-02-01");
      expect(mins).toBeGreaterThan(0);
      expect(mins).toBeLessThanOrEqual(120);
    });

    it("returns 0 for duration_minutes <= 0 or invalid range", () => {
      expect(
        eventMinutesInInclusiveRange(
          { date: "2025-02-01", start_minutes: 0, duration_minutes: -1 },
          "2025-02-01",
          "2025-02-01"
        )
      ).toBe(0);
      expect(
        eventMinutesInInclusiveRange(
          { date: "2025-02-01", start_minutes: 0, duration_minutes: 60 },
          "x",
          "y"
        )
      ).toBe(0);
    });
  });
});
