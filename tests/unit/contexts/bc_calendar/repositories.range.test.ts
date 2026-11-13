// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  parseLocalMidnight,
  eventStartMs,
  eventEndMs,
  eventOverlapsInclusiveRange,
} from "@/contexts/bc_calendar/repositories/range";

describe("bc_calendar/repositories/range", () => {
  describe("parseLocalMidnight", () => {
    it("parses YYYY-MM-DD to local midnight ms", () => {
      const ms = parseLocalMidnight("2025-06-15");
      expect(ms).toBe(new Date(2025, 5, 15).getTime());
    });

    it("returns NaN for invalid date parts", () => {
      expect(Number.isNaN(parseLocalMidnight("2025-0-15"))).toBe(true);
      expect(Number.isNaN(parseLocalMidnight(""))).toBe(true);
      expect(Number.isNaN(parseLocalMidnight("bad"))).toBe(true);
    });
  });

  describe("eventStartMs / eventEndMs", () => {
    it("computes start from date and start_minutes", () => {
      const day = parseLocalMidnight("2025-01-01");
      expect(eventStartMs({ date: "2025-01-01", start_minutes: 60 })).toBe(day + 60 * 60_000);
    });

    it("computes end from duration", () => {
      const start = eventStartMs({ date: "2025-01-01", start_minutes: 30 });
      expect(eventEndMs({ date: "2025-01-01", start_minutes: 30, duration_minutes: 45 })).toBe(
        start + 45 * 60_000
      );
    });
  });

  describe("eventOverlapsInclusiveRange", () => {
    const ev = { date: "2025-01-10", start_minutes: 12 * 60, duration_minutes: 120 };

    it("returns true when event intersects inclusive day range", () => {
      expect(eventOverlapsInclusiveRange(ev, "2025-01-10", "2025-01-10")).toBe(true);
      expect(eventOverlapsInclusiveRange(ev, "2025-01-09", "2025-01-10")).toBe(true);
    });

    it("returns false when entirely before or after range", () => {
      expect(eventOverlapsInclusiveRange(ev, "2025-01-01", "2025-01-05")).toBe(false);
      expect(eventOverlapsInclusiveRange(ev, "2025-01-20", "2025-01-25")).toBe(false);
    });

    it("returns false for invalid range dates", () => {
      expect(eventOverlapsInclusiveRange(ev, "", "2025-01-10")).toBe(false);
    });

    it("returns false when duration_minutes <= 0", () => {
      expect(
        eventOverlapsInclusiveRange(
          { date: "2025-01-10", start_minutes: 0, duration_minutes: 0 },
          "2025-01-10",
          "2025-01-10"
        )
      ).toBe(false);
    });
  });
});
