// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";
import { readProjectBoard, writeProjectTasks } from "@/contexts/bc_projects/repositories";
import { ConflictError, DomainError } from "@/lib/errors";
import { PathOutsideVaultError, WorkAreaBlockedError } from "@/lib/nexus/vault-fs";
import { useTempVault } from "../../helpers/tempVault";

const vault = useTempVault();
const TASKS = "Projects/demo/tasks.md";
const CTX = { today: "2026-11-13" };

const SAMPLE = `# Tasks — Demo

## Blokery

_Brak aktywnych blokerów_

## Next

- [ ] Drugie [now::]
- [ ] Trzecie

Ręczna notatka pod listą.

## Backlog

- [x] Zrobione — 2026-05-19
`;

function entry(folder = "Projects/demo/"): RegistryEntry {
  return {
    id: "demo",
    name: "Demo",
    status: "",
    priority: "",
    folder,
    localPath: "",
    owner: "personal",
  };
}

describe("bc_projects repositories: tablica zadań", () => {
  it("brak pliku: puste kolumny i version null", () => {
    expect(readProjectBoard(entry())).toEqual({
      blockers: [],
      now: [],
      next: [],
      icebox: [],
      version: null,
    });
  });

  it("odczyt tasks.md z wersją pliku", () => {
    vault.write(TASKS, SAMPLE);
    const board = readProjectBoard(entry());
    expect(board.next[0].text).toBe("Trzecie");
    expect(board.now[0].text).toBe("Drugie");
    expect(board.version).not.toBeNull();
  });

  it("zapis ze zgodną wersją zmienia tylko wskazaną linię i zwraca nową wersję", () => {
    vault.write(TASKS, SAMPLE);
    const { version } = readProjectBoard(entry());
    const next = writeProjectTasks(
      entry(),
      { op: "toggle", column: "next", index: 0, text: "Trzecie" },
      version,
      CTX
    );
    expect(vault.read(TASKS)).toBe(SAMPLE.replace("- [ ] Trzecie", "- [x] Trzecie — 2026-11-13"));
    expect(next).not.toEqual(version);
    expect(next).toEqual(readProjectBoard(entry()).version);
  });

  it("nieaktualna wersja: ConflictError, plik bez zmian", () => {
    vault.write(TASKS, SAMPLE);
    const stale = { size: 1, hash: "0".repeat(64) };
    expect(() =>
      writeProjectTasks(
        entry(),
        { op: "toggle", column: "next", index: 0, text: "Trzecie" },
        stale,
        CTX
      )
    ).toThrow(ConflictError);
    expect(vault.read(TASKS)).toBe(SAMPLE);
  });

  it("add do nieistniejącego pliku z expected null tworzy plik z nagłówkiem", () => {
    writeProjectTasks(entry(), { op: "add", column: "next", text: "x" }, null, CTX);
    expect(vault.read(TASKS)).toBe(
      "# Tasks — Demo\n\n## Blokery\n\n## Next\n\n- [ ] x\n\n## Backlog\n"
    );
  });

  it("oczekiwana wersja przy braku pliku: ConflictError", () => {
    expect(() =>
      writeProjectTasks(
        entry(),
        { op: "add", column: "next", text: "x" },
        { size: 1, hash: "0".repeat(64) },
        CTX
      )
    ).toThrow(ConflictError);
    expect(vault.read(TASKS)).toBeNull();
  });

  it("expected null przy istniejącym pliku: ConflictError", () => {
    vault.write(TASKS, SAMPLE);
    expect(() =>
      writeProjectTasks(entry(), { op: "add", column: "next", text: "x" }, null, CTX)
    ).toThrow(ConflictError);
    expect(vault.read(TASKS)).toBe(SAMPLE);
  });

  it("CRLF: zapis jako LF, treść poza zmienioną linią nietknięta", () => {
    vault.write(TASKS, SAMPLE.replace(/\n/g, "\r\n"));
    const { version } = readProjectBoard(entry());
    writeProjectTasks(
      entry(),
      { op: "toggle", column: "next", index: 0, text: "Trzecie" },
      version,
      CTX
    );
    const out = vault.read(TASKS);
    expect(out).not.toContain("\r");
    expect(out).toBe(SAMPLE.replace("- [ ] Trzecie", "- [x] Trzecie — 2026-11-13"));
  });

  it("strażnik: Work/ i ścieżka poza vaultem", () => {
    const op = { op: "add", column: "next", text: "x" } as const;
    expect(() => writeProjectTasks(entry("Work/x/"), op, null, CTX)).toThrow(WorkAreaBlockedError);
    expect(() => writeProjectTasks(entry("../x/"), op, null, CTX)).toThrow(PathOutsideVaultError);
  });

  it.each([
    ["Notes/x/"],
    ["Projects/"],
    ["Projects/."],
    ["Projects/./"],
    ["Projects/a/b/"],
    ["Archive/Projects/x/"],
    ["projects-x/y/"],
  ])("folder %s: zapis odrzucony (422), nic nie powstaje", (folder) => {
    try {
      writeProjectTasks(entry(folder), { op: "add", column: "next", text: "x" }, null, CTX);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect((err as DomainError).statusCode).toBe(422);
    }
    expect(vault.read(`${folder}tasks.md`)).toBeNull();
  });
});
