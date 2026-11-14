// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  archiveDateOf,
  daysBetween,
  isArchivable,
  isIsoDay,
  localIsoDate,
} from "@/lib/schema/archive-date";

describe("archiveDateOf", () => {
  it("doneDate z parsera ma pierwszeństwo przed datą w tekście", () => {
    expect(archiveDateOf({ text: "X — 2026-01-01; nota", doneDate: "2026-11-13" })).toBe(
      "2026-11-13"
    );
  });

  it.each([
    ["X — 2026-11-13", "2026-11-13"],
    ["X — 2026-11-13; sprawdzone ręcznie", "2026-11-13"],
    ["X — 2026-11-14: opis", "2026-11-14"],
    ["X — 2026-11-13 (nota)", "2026-11-13"],
    ["X — 2026-11-13, dalej", "2026-11-13"],
    ["X — 2026-11-13.", "2026-11-13"],
    ["(X — 2026-11-13)", "2026-11-13"],
  ])("bez doneDate: %s → %s", (text, expected) => {
    expect(archiveDateOf({ text })).toBe(expected);
  });

  it("bierze pierwsze wystąpienie „— RRRR-MM-DD”", () => {
    expect(archiveDateOf({ text: "X — 2026-11-01 i potem — 2026-11-09" })).toBe("2026-11-01");
  });

  it.each([["X"], ["X — 2026-11-13abc"], ["X 2026-11-13"], ["X — 2026-13-45"]])(
    "brak poprawnej daty: %s → null",
    (text) => {
      expect(archiveDateOf({ text })).toBeNull();
    }
  );
});

describe("daysBetween", () => {
  it("liczy dni kalendarzowe z samych dat (zmiana czasu nie przesuwa wyniku)", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-03-29", "2026-03-30")).toBe(1);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-11-20", "2026-11-14")).toBe(-6);
  });
});

describe("isArchivable", () => {
  const TODAY = "2026-11-14";
  const done = (doneDate?: string, text = "X") =>
    doneDate === undefined ? { done: true, text } : { done: true, text, doneDate };

  it("N = 3: 2026-11-10 tak, 2026-11-11 nie", () => {
    expect(isArchivable(done("2026-11-10"), TODAY, 3)).toBe(true);
    expect(isArchivable(done("2026-11-11"), TODAY, 3)).toBe(false);
  });

  it("N = 7: 2026-11-06 tak, 2026-11-07 nie", () => {
    expect(isArchivable(done("2026-11-06"), TODAY, 7)).toBe(true);
    expect(isArchivable(done("2026-11-07"), TODAY, 7)).toBe(false);
  });

  it("zmiana czasu: dziś 2026-03-30, N = 1: 03-28 tak, 03-29 nie", () => {
    expect(isArchivable(done("2026-03-28"), "2026-03-30", 1)).toBe(true);
    expect(isArchivable(done("2026-03-29"), "2026-03-30", 1)).toBe(false);
  });

  it("ukończone bez żadnej daty: zawsze", () => {
    expect(isArchivable(done(undefined), TODAY, 30)).toBe(true);
  });

  it("data z dopiskiem po dacie podlega progowi (nie jest „bez daty”)", () => {
    expect(isArchivable(done(undefined, "X — 2026-11-13; sprawdzone"), TODAY, 3)).toBe(false);
    expect(isArchivable(done(undefined, "X — 2026-11-01; sprawdzone"), TODAY, 3)).toBe(true);
  });

  it("otwarte nigdy; data z przyszłości nie", () => {
    expect(isArchivable({ done: false, text: "X — 2026-01-01" }, TODAY, 1)).toBe(false);
    expect(isArchivable(done("2026-11-20"), TODAY, 1)).toBe(false);
  });
});

describe("isIsoDay, localIsoDate", () => {
  it("waliduje datę kalendarzową", () => {
    expect(isIsoDay("2026-02-28")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("2026-2-3")).toBe(false);
  });

  it("localIsoDate: data lokalna RRRR-MM-DD", () => {
    expect(localIsoDate(new Date(2026, 10, 4, 23, 30))).toBe("2026-11-04");
  });
});
