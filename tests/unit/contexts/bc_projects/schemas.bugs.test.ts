// @vitest-environment node
import { describe, expect, it } from "vitest";
import { toBugDto } from "@/contexts/bc_projects/schemas";

describe("toBugDto", () => {
  it("kopiuje ustawione pola", () => {
    const bug = {
      id: "GP-001",
      title: "Porty",
      section: "Aktywne",
      priority: "medium",
      status: "otwarty",
      file: "start_v2.bat",
      opened: "2026-11-10",
      description: "opis",
      fix: "naprawa",
      ageDays: 5,
      stale: true,
      task: { column: "next" as const, done: false },
    };
    expect(toBugDto(bug)).toStrictEqual(bug);
  });

  it("pomija pola bez wartości (brak kluczy z undefined)", () => {
    const dto = toBugDto({ id: "A-1", title: "t", section: "Zamknięte", priority: undefined });
    expect(Object.keys(dto)).toEqual(["id", "title", "section"]);
  });

  it("zamknięty bug: Rozwiązanie z datą", () => {
    const dto = toBugDto({
      id: "EA-001",
      title: "t",
      section: "Zamknięte",
      resolution: "Cron",
      closedOn: "2026-05-19",
    });
    expect(dto.resolution).toBe("Cron");
    expect(dto.closedOn).toBe("2026-05-19");
  });
});
