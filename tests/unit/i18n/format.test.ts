import { describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import {
  formatDate,
  formatTime,
  formatTimeSeconds,
  formatShortDate,
  formatFullDate,
} from "@/src/i18n/format";

const MONDAY = new Date(2026, 10, 16);

describe("formatDate", () => {
  test("PL: poniedziałek, 16 listopada", () => {
    expect(formatDate(MONDAY, "pl")).toBe("poniedziałek, 16 listopada");
  });

  test("EN: Monday, November 16", () => {
    expect(formatDate(MONDAY, "en")).toBe("Monday, November 16");
  });

  test("bez drugiego argumentu bierze bieżący język", async () => {
    expect(formatDate(MONDAY)).toBe("poniedziałek, 16 listopada");
    await setLanguage("en");
    expect(formatDate(MONDAY)).toBe("Monday, November 16");
  });
});

describe("formatery Planowania", () => {
  const d = new Date(2026, 10, 15, 9, 5, 30); // niedziela 15.11.2026, czas lokalny
  const norm = (s: string) => s.replace(/\s/g, " ");

  test("formatTime", () => {
    expect(formatTime(d, "pl")).toBe("09:05");
    expect(norm(formatTime(d, "en"))).toBe("09:05 AM");
  });
  test("formatTimeSeconds", () => {
    expect(formatTimeSeconds(d, "pl")).toBe("09:05:30");
    expect(norm(formatTimeSeconds(d, "en"))).toBe("09:05:30 AM");
  });
  test("formatShortDate", () => {
    expect(formatShortDate(d, "pl")).toBe("15.11.2026");
    expect(formatShortDate(d, "en")).toBe("11/15/2026");
  });
  test("formatFullDate", () => {
    expect(formatFullDate(d, "pl")).toBe("niedziela, 15 listopada 2026");
    expect(formatFullDate(d, "en")).toBe("Sunday, November 15, 2026");
  });
});
