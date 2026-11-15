import { describe, expect, test } from "vitest";
import { setLanguage } from "@/src/i18n";
import {
  archiveConfirmQuestion,
  archiveMovedNotice,
  columnTaskCountLabel,
  devlogEntriesLabel,
  packBudgetMeta,
  packButtonSizeSuffix,
  packTileValue,
  registryProjectsLabel,
  tokensThousandLabel,
} from "@/src/features/projects/projectsFormat";

describe("etykiety Projekty po angielsku", () => {
  test("registryProjectsLabel (plural projektów w rejestrze)", async () => {
    await setLanguage("en");
    expect(registryProjectsLabel(1)).toBe("1 project");
    expect(registryProjectsLabel(2)).toBe("2 projects");
    expect(registryProjectsLabel(5)).toBe("5 projects");
  });

  test("columnTaskCountLabel", async () => {
    await setLanguage("en");
    expect(columnTaskCountLabel("icebox", 3)).toBe("3 deferred");
    expect(columnTaskCountLabel("next", 1)).toBe("1 task");
    expect(columnTaskCountLabel("next", 2)).toBe("2 tasks");
    expect(columnTaskCountLabel("next", 5)).toBe("5 tasks");
    expect(columnTaskCountLabel("next", 22)).toBe("22 tasks");
  });

  test("devlogEntriesLabel", async () => {
    await setLanguage("en");
    expect(devlogEntriesLabel(1)).toBe("1 entry");
    expect(devlogEntriesLabel(3)).toBe("3 entries");
  });

  test("archiwizacja i paczka", async () => {
    await setLanguage("en");
    expect(archiveMovedNotice(3)).toBe("Moved 3 tasks to changelog.md");
    expect(archiveConfirmQuestion(2, 0)).toBe("Move 2 tasks to changelog.md?");
    expect(archiveConfirmQuestion(3, 1)).toBe(
      "Move 3 tasks to changelog.md (including 1 without date)?"
    );
    expect(packTileValue(3850)).toBe("3,850 tok");
    expect(packBudgetMeta(96, 4000, false)).toBe("96% of 4,000 token budget");
    expect(packBudgetMeta(96, 4000, true)).toBe("96% of 4,000 token budget · truncated");
    expect(tokensThousandLabel(3200)).toBe("~3.2k tokens");
    expect(packButtonSizeSuffix(3200)).toBe(" (~3.2k tok)");
  });
});

describe("etykiety Projekty po polsku (plural, setup PL)", () => {
  test("formatowanie tokenów PL (dosłownie jak dziś)", () => {
    expect(packTileValue(3850)).toBe("3 850 tok");
    expect(tokensThousandLabel(3200)).toBe("~3,2 tys. tokenów");
    expect(packButtonSizeSuffix(3200)).toBe(" (~3,2 tys. tok)");
  });

  test("columnTaskCountLabel", () => {
    expect(columnTaskCountLabel("next", 1)).toBe("1 zadanie");
    expect(columnTaskCountLabel("next", 2)).toBe("2 zadania");
    expect(columnTaskCountLabel("next", 5)).toBe("5 zadań");
    expect(columnTaskCountLabel("next", 22)).toBe("22 zadania");
  });

  test("registryProjectsLabel", () => {
    expect(registryProjectsLabel(22)).toBe("22 projekty");
    expect(registryProjectsLabel(12)).toBe("12 projektów");
  });
});
