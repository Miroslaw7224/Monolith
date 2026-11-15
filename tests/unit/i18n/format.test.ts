import { describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import { formatDate } from "@/src/i18n/format";

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
