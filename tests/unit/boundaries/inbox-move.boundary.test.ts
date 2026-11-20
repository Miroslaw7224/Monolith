// @vitest-environment node
/**
 * Granica `bc_inbox` → `bc_projects` / `bc_tasks` / `bc_notes` (ASERCJE-3) bez żadnych atrap: `moveItem`
 * zapisuje w celu przez prawdziwe serwisy dostawców w tymczasowym vaulcie, a wynik czytamy ich własnymi serwisami.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { addItem, listItems, moveItem } from "@/contexts/bc_inbox/services";
import { listNotes } from "@/contexts/bc_notes/services";
import { getProject } from "@/contexts/bc_projects/services";
import { getTasks } from "@/contexts/bc_tasks/services";
import { NotFoundError } from "@/lib/errors";
import { boundaryRegistry, REGISTRY_PATH } from "../helpers/boundaryRegistry";
import { setupTempVault } from "../helpers/tempVault";

const vault = setupTempVault();

const TASKS = "# Tasks — Alfa\n\n## Next\n\n- [ ] Istniejące\n\n## Backlog\n\n- [ ] Kiedyś\n";

/** Treść sekcji `## <name>` pliku `tasks.md` (do następnego nagłówka `## `). */
function section(md: string, name: string): string {
  const start = md.indexOf(`## ${name}\n`);
  const rest = md.slice(start + name.length + 4);
  const end = rest.indexOf("\n## ");
  return end === -1 ? rest : rest.slice(0, end);
}

beforeEach(() => {
  vault.write(REGISTRY_PATH, boundaryRegistry("/tmp/alfa", "/tmp/beta"));
  vault.write("Projects/alfa/tasks.md", TASKS);
});

describe("granica inbox ↔ projects / tasks / notes", () => {
  it("do projektu: zadanie w kolumnie Next tablicy, wpis zamknięty", async () => {
    const { id } = await addItem("kupić domenę");
    await expect(
      moveItem(id, { target: "project", projectId: "alfa", column: "next", text: "kupić domenę" })
    ).resolves.toEqual({ target: "project", ref: "alfa" });

    expect(section(vault.read("Projects/alfa/tasks.md"), "Next")).toContain("- [ ] kupić domenę");
    expect(section(vault.read("Projects/alfa/tasks.md"), "Backlog")).not.toContain("kupić domenę");
    expect(getProject("alfa").board.next.map((t) => t.text)).toEqual([
      "Istniejące",
      "kupić domenę",
    ]);
    expect(listItems()).toEqual([]);
  });

  it("do zadań: ref to id zadania z bc_tasks", async () => {
    const { id } = await addItem("zadzwonić");
    const result = await moveItem(id, { target: "task", text: "zadzwonić" });

    const tasks = await getTasks();
    expect(tasks.map((t) => t.title)).toEqual(["zadzwonić"]);
    expect(result).toEqual({ target: "task", ref: tasks[0].id });
    expect(listItems()).toEqual([]);
  });

  it("do notatki: ref to id notatki z bc_notes z tytułem i treścią", async () => {
    const { id } = await addItem("pomysł");
    const result = await moveItem(id, { target: "note", title: "Pomysł", text: "treść" });

    const notes = await listNotes();
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: "Pomysł", content: "treść" });
    expect(result).toEqual({ target: "note", ref: notes[0].id });
    expect(listItems()).toEqual([]);
  });

  it("nieznany projekt: NotFoundError z bc_projects, wpis zostaje otwarty", async () => {
    const item = await addItem("do nikąd");
    const move = moveItem(item.id, {
      target: "project",
      projectId: "nie-ma",
      column: "next",
      text: "do nikąd",
    });

    await expect(move).rejects.toThrow(NotFoundError);
    await expect(move).rejects.toThrow("Nie ma projektu o id nie-ma");
    expect(listItems()).toEqual([item]);
  });
});
