import { describe, expect, it } from "vitest";
import {
  commitsLabel,
  anchorLabel,
  formatLongDate,
  hhmm,
  meetingsLabel,
  projectsLabel,
  minutesUntil,
  relativeDays,
  timelineRange,
  weekNumber,
} from "@/src/features/home/cockpitFormat";

describe("hhmm", () => {
  it("formatuje minuty od północy", () => {
    expect(hhmm(590)).toBe("09:50");
    expect(hhmm(0)).toBe("00:00");
    expect(hhmm(1439)).toBe("23:59");
  });
});

describe("weekNumber (ISO 8601)", () => {
  it("liczy tydzień roku", () => {
    expect(weekNumber(new Date(2026, 10, 11))).toBe(46);
    expect(weekNumber(new Date(2026, 0, 1))).toBe(1);
    expect(weekNumber(new Date(2021, 0, 3))).toBe(53);
  });
});

describe("minutesUntil", () => {
  it("różnica do startu, ujemna gdy minęło", () => {
    expect(minutesUntil(588, 630)).toBe(42);
    expect(minutesUntil(700, 630)).toBe(-70);
  });
});

describe("relativeDays", () => {
  const today = new Date(2026, 10, 11);
  it("dziś / wczoraj / N dni temu", () => {
    expect(relativeDays("2026-11-11", today)).toBe("dziś");
    expect(relativeDays("2026-11-10", today)).toBe("wczoraj");
    expect(relativeDays("2026-11-05", today)).toBe("6 dni temu");
    expect(relativeDays("2026-11-10T21:40", today)).toBe("wczoraj");
  });
  it("brak lub błędna data → null", () => {
    expect(relativeDays(null, today)).toBeNull();
    expect(relativeDays("jutro", today)).toBeNull();
  });
  it("data z przyszłości → dziś (nie ujemne dni)", () => {
    expect(relativeDays("2026-11-20", today)).toBe("dziś");
  });
});

describe("formatLongDate", () => {
  it("dzień tygodnia z wielkiej litery, dzień i miesiąc", () => {
    expect(formatLongDate(new Date(2026, 10, 11))).toBe("Środa, 11 listopada");
    expect(formatLongDate(new Date(2026, 10, 13))).toBe("Piątek, 13 listopada");
  });
});

describe("meetingsLabel", () => {
  it("odmienia liczbę spotkań", () => {
    expect(meetingsLabel(0)).toBe("brak spotkań dziś");
    expect(meetingsLabel(1)).toBe("1 spotkanie dziś");
    expect(meetingsLabel(3)).toBe("3 spotkania dziś");
    expect(meetingsLabel(5)).toBe("5 spotkań dziś");
    expect(meetingsLabel(12)).toBe("12 spotkań dziś");
    expect(meetingsLabel(22)).toBe("22 spotkania dziś");
  });
});

describe("timelineRange", () => {
  it("domyślnie 08–18", () => {
    expect(timelineRange([])).toEqual({ from: 8, to: 18 });
    expect(timelineRange([{ startMinutes: 600, durationMinutes: 30 }])).toEqual({
      from: 8,
      to: 18,
    });
  });
  it("rozszerza do pełnych godzin wokół wydarzeń", () => {
    expect(timelineRange([{ startMinutes: 7 * 60 + 15, durationMinutes: 30 }]).from).toBe(7);
    expect(timelineRange([{ startMinutes: 17 * 60, durationMinutes: 90 }]).to).toBe(19);
  });
});

describe("projectsLabel", () => {
  it("odmienia liczbę projektów z commitami", () => {
    expect(projectsLabel(0)).toBe("jeszcze bez commitów");
    expect(projectsLabel(1)).toBe("1 projekt");
    expect(projectsLabel(2)).toBe("2 projekty");
    expect(projectsLabel(5)).toBe("5 projektów");
    expect(projectsLabel(12)).toBe("12 projektów");
    expect(projectsLabel(22)).toBe("22 projekty");
  });
});

describe("anchorLabel", () => {
  const today = new Date(2026, 10, 13);
  it("wczoraj, sprzed N dni, dziś i błędna data", () => {
    expect(anchorLabel("2026-11-12", today)).toBe("Zaczep z wczoraj");
    expect(anchorLabel("2026-11-10", today)).toBe("Zaczep sprzed 3 dni");
    expect(anchorLabel("2026-11-13", today)).toBe("Zaczep");
    expect(anchorLabel("jutro", today)).toBe("Zaczep");
  });
});

describe("commitsLabel", () => {
  it("odmienia liczbę commitów", () => {
    expect(commitsLabel(0)).toBe("0 commitów");
    expect(commitsLabel(1)).toBe("1 commit");
    expect(commitsLabel(2)).toBe("2 commity");
    expect(commitsLabel(5)).toBe("5 commitów");
    expect(commitsLabel(12)).toBe("12 commitów");
    expect(commitsLabel(22)).toBe("22 commity");
  });
});
