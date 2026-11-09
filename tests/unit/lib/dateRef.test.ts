import { describe, it, expect } from "vitest";
import { formatYmd, weekRangeMonSun } from "@/lib/dateRef";

describe("dateRef", () => {
  it("formatYmd formats local date with zero padding", () => {
    expect(formatYmd(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("weekRangeMonSun returns Monday–Sunday for a Monday", () => {
    expect(weekRangeMonSun(new Date(2026, 10, 9))).toEqual({
      start: "2026-11-09",
      end: "2026-11-15",
    });
  });

  it("weekRangeMonSun treats Sunday as the last day of the week", () => {
    expect(weekRangeMonSun(new Date(2026, 10, 15))).toEqual({
      start: "2026-11-09",
      end: "2026-11-15",
    });
  });
});
