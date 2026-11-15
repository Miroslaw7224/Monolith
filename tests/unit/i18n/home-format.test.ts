import { describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import { formatDayMonth, formatWeekdayShort } from "@/src/i18n/format";
import { projectKindLabel } from "@/src/i18n/projectKind";
import {
  anchorLabel,
  commitsLabel,
  formatLongDate,
  meetingDayLabel,
  meetingsLabel,
  projectsLabel,
  relativeDays,
  windowsLabel,
} from "@/src/features/home/cockpitFormat";

const today = new Date(2026, 10, 11); // 2026-11-11, środa

describe("etykiety Kokpitu po angielsku", () => {
  test("meetingsLabel", async () => {
    await setLanguage("en");
    expect(meetingsLabel(0)).toBe("no meetings today");
    expect(meetingsLabel(1)).toBe("1 meeting today");
    expect(meetingsLabel(3)).toBe("3 meetings today");
  });

  test("commitsLabel / projectsLabel / windowsLabel", async () => {
    await setLanguage("en");
    expect(commitsLabel(1)).toBe("1 commit");
    expect(commitsLabel(5)).toBe("5 commits");
    expect(projectsLabel(0)).toBe("no commits yet");
    expect(projectsLabel(1)).toBe("1 project");
    expect(projectsLabel(2)).toBe("2 projects");
    expect(windowsLabel(0)).toBe("");
    expect(windowsLabel(1)).toBe("1 Deep Work window");
    expect(windowsLabel(2)).toBe("2 Deep Work windows");
  });

  test("relativeDays i anchorLabel", async () => {
    await setLanguage("en");
    expect(relativeDays("2026-11-11", today)).toBe("today");
    expect(relativeDays("2026-11-10", today)).toBe("yesterday");
    expect(relativeDays("2026-11-08", today)).toBe("3 days ago");
    expect(relativeDays(null, today)).toBeNull();
    expect(anchorLabel("2026-11-10", today)).toBe("Anchor from yesterday");
    expect(anchorLabel("2026-11-08", today)).toBe("Anchor from 3 days ago");
    expect(anchorLabel("2026-11-11", today)).toBe("Anchor");
    expect(anchorLabel("zła-data", today)).toBe("Anchor");
  });

  test("daty", async () => {
    await setLanguage("en");
    expect(formatLongDate(today)).toBe("Wednesday, November 11");
    expect(meetingDayLabel("2026-11-12", "2026-11-11")).toBe("tomorrow");
    expect(meetingDayLabel("2026-11-18", "2026-11-11")).toBe("Wednesday, November 18");
    expect(formatDayMonth(today)).toBe("November 11");
    expect(formatWeekdayShort(today)).toBe("Wed");
  });
});

describe("etykiety Kokpitu po polsku (plural)", () => {
  test("meetingsLabel i commitsLabel", () => {
    expect(meetingsLabel(22)).toBe("22 spotkania dziś");
    expect(meetingsLabel(12)).toBe("12 spotkań dziś");
    expect(commitsLabel(22)).toBe("22 commity");
  });

  test("daty", () => {
    expect(formatLongDate(today)).toBe("Środa, 11 listopada");
    expect(formatDayMonth(today)).toBe("11 listopada");
  });
});

describe("projectKindLabel", () => {
  test("etykiety rodzajów projektów w obu językach", async () => {
    expect(projectKindLabel("etat")).toBe("Etat");
    expect(projectKindLabel("wlasny")).toBe("Własny");
    expect(projectKindLabel("biblioteka")).toBe("Biblioteka");
    await setLanguage("en");
    expect(projectKindLabel("etat")).toBe("Day job");
    expect(projectKindLabel("wlasny")).toBe("Own");
    expect(projectKindLabel("biblioteka")).toBe("Library");
  });
});
