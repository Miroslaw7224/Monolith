import { describe, expect, it } from "vitest";
import { KAL_HOUR_PX, weekScrollTop } from "@/src/features/calendar/calendarUtils";

describe("weekScrollTop", () => {
  it("tydzień z dzisiejszym dniem: aktualna godzina leży 2 h pod górną krawędzią", () => {
    expect(weekScrollTop(14 * 60, true)).toBe(12 * KAL_HOUR_PX);
  });

  it("uwzględnia minuty (14:30 → 12,5 h)", () => {
    expect(weekScrollTop(14 * 60 + 30, true)).toBe(12.5 * KAL_HOUR_PX);
  });

  it("wczesna godzina nie daje wartości ujemnej", () => {
    expect(weekScrollTop(60, true)).toBe(0);
    expect(weekScrollTop(0, true)).toBe(0);
  });

  it("inny tydzień (bez dzisiaj): domyślnie okolice 07:00", () => {
    expect(weekScrollTop(14 * 60, false)).toBe(7 * KAL_HOUR_PX);
  });
});
