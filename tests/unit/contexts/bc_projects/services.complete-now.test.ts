// @vitest-environment node
import { describe, expect, it } from "vitest";
import { completeNowTask, rewriteNowTask } from "@/contexts/bc_projects/services";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { setupTempVault } from "../../helpers/tempVault";

const vault = setupTempVault();
const TASKS_FILE = "Projects/a/tasks.md";
const NOW = new Date(2026, 10, 13, 9, 15);

type Item = { text: string; done?: boolean };

/** Zapisuje `tasks.md` z kolumną Teraz (znacznik `[now::]`) w formacie czytanym przez repozytorium. */
const seed = (...items: Item[]) => {
  vault.write(
    "Projects/_registry.yaml",
    "projects:\n  - id: a\n    name: A\n    status: active\n    priority: high\n    folder: Projects/a/\n"
  );
  vault.write(TASKS_FILE, tasksText(...items));
};
const tasksText = (...items: Item[]) =>
  [
    "# Tasks — A",
    "",
    "## Next",
    "",
    ...items.map((i) => (i.done ? `- [x] ${i.text} — 2026-11-01` : `- [ ] ${i.text} [now::]`)),
    "",
  ].join("\n");

describe("completeNowTask", () => {
  it("znajduje zadanie w kolumnie Teraz po tekście i zamyka je z datą dnia", async () => {
    seed({ text: "X" }, { text: "Y" });

    await completeNowTask("a", "Y", 0, NOW);

    expect(vault.read(TASKS_FILE)).toBe(
      "# Tasks — A\n\n## Next\n\n- [ ] X [now::]\n- [x] Y — 2026-11-13\n"
    );
  });

  // Ukończone zadanie ląduje tuż za ostatnim otwartym (reorderBlock w tasks-file).
  it("przy identycznych tekstach bierze pierwsze niezakończone", async () => {
    seed({ text: "Z", done: true }, { text: "Z" }, { text: "Z" });

    await completeNowTask("a", "Z", 0, NOW);

    expect(vault.read(TASKS_FILE)).toBe(
      "# Tasks — A\n\n## Next\n\n- [x] Z — 2026-11-01\n- [ ] Z [now::]\n- [x] Z — 2026-11-13\n"
    );
  });

  it("occurrence wskazuje n-te niezakończone zadanie o tym samym tekście", async () => {
    seed({ text: "Z" }, { text: "Y" }, { text: "Z", done: true }, { text: "Z" });

    await completeNowTask("a", "Z", 1, NOW);

    expect(vault.read(TASKS_FILE)).toBe(
      "# Tasks — A\n\n## Next\n\n- [ ] Z [now::]\n- [ ] Y [now::]\n- [x] Z — 2026-11-13\n- [x] Z — 2026-11-01\n"
    );
  });

  it("occurrence większe niż liczba takich zadań: ConflictError, plik bez zmian", async () => {
    seed({ text: "Z" });

    await expect(completeNowTask("a", "Z", 1, NOW)).rejects.toBeInstanceOf(ConflictError);

    expect(vault.read(TASKS_FILE)).toBe(tasksText({ text: "Z" }));
  });

  it("brak takiego zadania (plik zmienił się): ConflictError, plik bez zmian", async () => {
    seed({ text: "X" });

    await expect(completeNowTask("a", "Nie ma", 0, NOW)).rejects.toBeInstanceOf(ConflictError);

    expect(vault.read(TASKS_FILE)).toBe(tasksText({ text: "X" }));
  });

  it("nieznany projekt: NotFoundError", async () => {
    seed({ text: "X" });

    await expect(completeNowTask("zzz", "X", 0, NOW)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("rewriteNowTask", () => {
  it("podmienia tekst zadania z kolumny Teraz, reszta pliku zostaje", async () => {
    seed({ text: "X" }, { text: "Y" });

    await rewriteNowTask("a", "Y", "Y #deep", 0, NOW);

    expect(vault.read(TASKS_FILE)).toBe(tasksText({ text: "X" }, { text: "Y #deep" }));
  });

  it("brak takiego zadania (plik zmienił się): ConflictError, plik bez zmian", async () => {
    seed({ text: "X", done: true });

    await expect(rewriteNowTask("a", "X", "X #deep", 0, NOW)).rejects.toBeInstanceOf(ConflictError);

    expect(vault.read(TASKS_FILE)).toBe(tasksText({ text: "X", done: true }));
  });
});

describe("rewriteNowTask: occurrence", () => {
  it("edytuje n-te niezakończone zadanie o tym tekście", async () => {
    seed({ text: "X" }, { text: "X" });

    await rewriteNowTask("a", "X", "X #quick", 1, NOW);

    expect(vault.read(TASKS_FILE)).toBe(tasksText({ text: "X" }, { text: "X #quick" }));
  });

  it("zwraca occurrence nowego tekstu: ile niezakończonych zadań o nim stoi wcześniej", async () => {
    seed({ text: "X #deep" }, { text: "X" }, { text: "X #deep", done: true });

    // „X” z indeksu 1 staje się „X #deep”; wcześniej jest jedno otwarte „X #deep” (zamknięte się nie liczy)
    expect(await rewriteNowTask("a", "X", "X #deep", 0, NOW)).toBe(1);

    vault.write(TASKS_FILE, tasksText({ text: "A" }, { text: "B" }));
    expect(await rewriteNowTask("a", "B", "B #deep", 0, NOW)).toBe(0);
  });
});
