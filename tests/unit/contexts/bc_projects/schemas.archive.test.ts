// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { ProjectWithContent } from "@/contexts/bc_projects/models";
import {
  ARCHIVE_DAYS_OPTIONS,
  ARCHIVE_DEFAULT_DAYS,
  ArchiveDoneInputSchema,
  archiveDateOf,
  isArchivable,
  toArchiveDto,
  toDetailDto,
} from "@/contexts/bc_projects/schemas";
import * as lib from "@/lib/schema/archive-date";

const HASH = "a".repeat(64);

describe("ArchiveDoneInputSchema", () => {
  it("version null (plik ma nie istnieć) i próg", () => {
    const r = ArchiveDoneInputSchema.safeParse({ version: null, olderThanDays: 7 });
    expect(r.success && r.data).toEqual({ version: null, olderThanDays: 7 });
  });

  it("version size:hash zamieniona na obiekt", () => {
    const r = ArchiveDoneInputSchema.safeParse({ version: `7:${HASH}`, olderThanDays: 3 });
    expect(r.success && r.data.version).toEqual({ size: 7, hash: HASH });
  });

  it.each([[1], [30]])("próg %i jest poprawny", (olderThanDays) => {
    expect(ArchiveDoneInputSchema.safeParse({ version: null, olderThanDays }).success).toBe(true);
  });

  it.each([[0], [31], [1.5], ["7"], [-1]])("próg %j jest odrzucony", (olderThanDays) => {
    expect(ArchiveDoneInputSchema.safeParse({ version: null, olderThanDays }).success).toBe(false);
  });

  it("brak version albo zła wersja: odrzucone", () => {
    expect(ArchiveDoneInputSchema.safeParse({ olderThanDays: 7 }).success).toBe(false);
    expect(ArchiveDoneInputSchema.safeParse({ version: "zła", olderThanDays: 7 }).success).toBe(
      false
    );
  });
});

describe("archiwizacja: stałe i re-eksporty", () => {
  it("UI oferuje 3, 5, 7 (domyślnie 7)", () => {
    expect(ARCHIVE_DAYS_OPTIONS).toEqual([3, 5, 7]);
    expect(ARCHIVE_DEFAULT_DAYS).toBe(7);
  });

  it("schemas re-eksportuje te same funkcje co lib/schema", () => {
    expect(archiveDateOf).toBe(lib.archiveDateOf);
    expect(isArchivable).toBe(lib.isArchivable);
  });

  it("toArchiveDto: ProjectDetailDto plus archived", () => {
    const project: ProjectWithContent = {
      id: "a",
      name: "Alpha",
      status: "active",
      priority: "high",
      folder: "Projects/a/",
      localPath: "/tmp/a",
      owner: "personal",
      whereIStopped: null,
      purpose: null,
      freshness: "fresh",
      tasks: [],
      board: { blockers: [], now: [], next: [], icebox: [], version: null },
      bugs: [],
      state: null,
      stateVersion: null,
      devlog: [],
    };
    expect(toArchiveDto(project, 3)).toEqual({ ...toDetailDto(project), archived: 3 });
  });
});
