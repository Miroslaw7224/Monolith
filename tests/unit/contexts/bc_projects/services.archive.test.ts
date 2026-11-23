// @vitest-environment node
import { describe, expect, it } from "vitest";
import { archiveDone, getProject } from "@/contexts/bc_projects/services";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { setupTempVault } from "../../helpers/tempVault";

const vault = setupTempVault();
const TASKS = "Projects/a/tasks.md";
const CHANGELOG = "Projects/a/changelog.md";
const NOW = new Date(2026, 10, 13, 12, 0);

const SAMPLE = `# Tasks — Alpha

## Next

- [ ] Otwarte
- [x] Stare — 2026-11-01
- [x] Świeże — 2026-11-12
`;

const seed = () => {
  vault.write(
    "Projects/_registry.yaml",
    "projects:\n  - id: a\n    name: Alpha\n    status: active\n    priority: high\n    folder: Projects/a/\n"
  );
  vault.write(TASKS, SAMPLE);
};
const version = () => getProject("a", NOW).board.version;

describe("bc_projects services: archiveDone", () => {
  it("przenosi stare ukończone zadania do changelogu, zwraca świeży projekt i liczbę", async () => {
    seed();

    const result = await archiveDone("a", version(), 3, NOW);

    expect(vault.read(TASKS)).toBe(`# Tasks — Alpha

## Next

- [ ] Otwarte
- [x] Świeże — 2026-11-12
`);
    expect(vault.read(CHANGELOG)).toBe(
      "# Changelog — Alpha\n\n## 2026-11\n\n- [x] Stare — 2026-11-01\n"
    );
    expect(result.archived).toBe(1);
    expect(result.project.id).toBe("a");
    expect(result.project.board.next.map((t) => t.text)).toEqual(["Otwarte", "Świeże"]);
  });

  it("zmiana tasks.md w międzyczasie (409): pliki bez zmian", async () => {
    seed();
    const stale = version();
    vault.write(TASKS, `${SAMPLE}- [ ] Dopisane ręcznie\n`);

    await expect(archiveDone("a", stale, 7, NOW)).rejects.toBeInstanceOf(ConflictError);

    expect(vault.read(TASKS)).toBe(`${SAMPLE}- [ ] Dopisane ręcznie\n`);
    expect(vault.read(CHANGELOG)).toBeNull();
  });

  it("nieznany projekt: NotFoundError, nic nie powstaje", async () => {
    seed();

    await expect(archiveDone("nie-ma", version(), 7, NOW)).rejects.toBeInstanceOf(NotFoundError);

    expect(vault.read("Projects/nie-ma/changelog.md")).toBeNull();
    expect(vault.read(CHANGELOG)).toBeNull();
  });
});
