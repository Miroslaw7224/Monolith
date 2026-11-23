// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RegistryEntry } from "@/contexts/bc_projects/models";
import {
  archiveDoneTasks,
  readAiContext,
  readDevlog,
  readIndexRules,
  readProjectBoard,
  readProjectContent,
  readProjectIndex,
} from "@/contexts/bc_projects/repositories";
import { ConflictError, DomainError } from "@/lib/errors";
import { WorkAreaBlockedError } from "@/lib/nexus/vault-fs";
import { setupTempVault } from "../../helpers/tempVault";

/** Hak po zapisie changelogu (przed zapisem tasks.md): pozwala zasymulować zmianę pliku między krokami. */
const hook = vi.hoisted(() => ({ afterChangelog: null as null | (() => void) }));
vi.mock("@/lib/nexus/vault-fs", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/nexus/vault-fs")>();
  return {
    ...real,
    updateVaultFile: async (...args: Parameters<typeof real.updateVaultFile>) => {
      const result = await real.updateVaultFile(...args);
      hook.afterChangelog?.();
      return result;
    },
  };
});

const vault = setupTempVault();
const TASKS = "Projects/demo/tasks.md";
const CHANGELOG = "Projects/demo/changelog.md";
const CTX = { today: "2026-11-14", olderThanDays: 3 };

const SAMPLE = `# Tasks — Demo

## Next

- [ ] Otwarte
- [x] Stare — 2026-11-10
- [x] Świeże — 2026-11-13

## Backlog

- [x] Bez daty
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

const version = () => readProjectBoard(entry()).version;

describe("bc_projects repositories: archiveDoneTasks", () => {
  it("przenosi ukończone do nowego changelog.md i usuwa je z tasks.md", async () => {
    vault.write(TASKS, SAMPLE);
    const result = await archiveDoneTasks(entry(), version(), CTX);
    expect(result.archived).toBe(2);
    expect(vault.read(CHANGELOG)).toBe(
      "# Changelog — Demo\n\n## 2026-11\n\n- [x] Stare — 2026-11-10\n\n## Bez daty\n\n- [x] Bez daty\n"
    );
    expect(vault.read(TASKS)).toBe(
      "# Tasks — Demo\n\n## Next\n\n- [ ] Otwarte\n- [x] Świeże — 2026-11-13\n\n## Backlog\n\n"
    );
  });

  it("dopisuje do istniejącego changelog.md (bez deduplikacji)", async () => {
    vault.write(TASKS, SAMPLE);
    vault.write(CHANGELOG, "# Changelog — Demo\n\n## 2026-11\n\n- [x] Stare — 2026-11-10\n");
    await archiveDoneTasks(entry(), version(), CTX);
    expect(vault.read(CHANGELOG)).toContain(
      "## 2026-11\n\n- [x] Stare — 2026-11-10\n- [x] Stare — 2026-11-10\n"
    );
  });

  it("brak kwalifikujących się zadań: archived 0, żaden plik nie powstaje ani nie zmienia się", async () => {
    const open = "## Next\n\n- [ ] A\n- [x] B — 2026-11-13\n";
    vault.write(TASKS, open);
    const result = await archiveDoneTasks(entry(), version(), CTX);
    expect(result).toEqual({ archived: 0, blocks: [] });
    expect(vault.read(TASKS)).toBe(open);
    expect(vault.read(CHANGELOG)).toBeNull();
  });

  it("brak tasks.md (version null): archived 0 bez zapisu", async () => {
    expect(await archiveDoneTasks(entry(), null, CTX)).toEqual({ archived: 0, blocks: [] });
    expect(vault.read(CHANGELOG)).toBeNull();
  });

  it("zła wersja: ConflictError przed dotknięciem changelog.md", async () => {
    vault.write(TASKS, SAMPLE);
    await expect(
      archiveDoneTasks(entry(), { size: 1, hash: "0".repeat(64) }, CTX)
    ).rejects.toBeInstanceOf(ConflictError);
    expect(vault.read(CHANGELOG)).toBeNull();
    expect(vault.read(TASKS)).toBe(SAMPLE);
  });

  it("zmiana tasks.md między krokami: ConflictError, changelog już zapisany, tasks.md nietknięty", async () => {
    vault.write(TASKS, SAMPLE);
    const v = version();
    const changed = `${SAMPLE}- [ ] Dopisane z zewnątrz\n`;
    hook.afterChangelog = () => fs.writeFileSync(path.join(vault.root, TASKS), changed, "utf8");
    try {
      await expect(archiveDoneTasks(entry(), v, CTX)).rejects.toBeInstanceOf(ConflictError);
    } finally {
      hook.afterChangelog = null;
    }
    expect(vault.read(CHANGELOG)).toContain("- [x] Stare — 2026-11-10");
    expect(vault.read(TASKS)).toBe(changed);
  });

  it("uszkodzony changelog.md: DomainError 422, żaden plik nie zmieniony", async () => {
    const bad = "# Changelog — Demo\n\n## Foo\n\n- [x] a\n";
    vault.write(TASKS, SAMPLE);
    vault.write(CHANGELOG, bad);
    const err = await archiveDoneTasks(entry(), version(), CTX).then(
      () => undefined,
      (e: unknown) => e
    );
    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).statusCode).toBe(422);
    expect((err as DomainError).message).toMatch(/changelog\.md/);
    expect(vault.read(CHANGELOG)).toBe(bad);
    expect(vault.read(TASKS)).toBe(SAMPLE);
  });

  it("strażnik zapisu: Work/ odrzucone", async () => {
    await expect(archiveDoneTasks(entry("Work/x/"), null, CTX)).rejects.toBeInstanceOf(
      WorkAreaBlockedError
    );
  });

  it("folder spoza Projects/<id>/: 422", async () => {
    await expect(archiveDoneTasks(entry("Notes/x/"), null, CTX)).rejects.toMatchObject({
      statusCode: 422,
    });
  });
});

describe("changelog.md poza czytnikami kontekstu agenta", () => {
  it("żaden czytnik projektu nie zwraca treści changelog.md", () => {
    vault.write(TASKS, "## Next\n\n- [ ] A\n");
    vault.write("Projects/demo/index.md", "# Demo\n");
    vault.write(
      CHANGELOG,
      "# Changelog — Demo\n\n## 2026-11\n\n- [x] SENTINEL-CHANGELOG — 2026-11-01\n"
    );
    const e = entry();
    const everything = JSON.stringify([
      readProjectContent(e),
      readProjectBoard(e),
      readDevlog(e),
      readProjectIndex(e),
      readAiContext(e),
      readIndexRules(e),
    ]);
    expect(everything).not.toContain("SENTINEL-CHANGELOG");
  });
});
