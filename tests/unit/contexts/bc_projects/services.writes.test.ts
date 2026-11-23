// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { VersionToken } from "@/contexts/bc_projects/models";
import {
  addDevlogEntry,
  applyTaskOp,
  getProject,
  saveState,
  setProjectType,
} from "@/contexts/bc_projects/services";
import { ConflictError, DomainError, NotFoundError } from "@/lib/errors";
import { setupTempVault } from "../../helpers/tempVault";

const vault = setupTempVault();

const TODAY = new Date(2026, 10, 12);
const NOW = new Date(2026, 10, 13, 9, 15);
const STATE_FILE = "Projects/a/state.md";
const DEVLOG_FILE = "Projects/a/devlog.md";
const INDEX_FILE = "Projects/a/index.md";
const TASKS_FILE = "Projects/a/tasks.md";

const seedRegistry = () =>
  vault.write(
    "Projects/_registry.yaml",
    "projects:\n  - id: a\n    name: A\n    status: active\n    priority: medium\n    folder: Projects/a/\n"
  );

const PREV_STATE = `---
branch: stary
env: ""
blocker: ""
next_step: ""
links: []
milestone: ""
updated: "2026-11-01T10:00"
---

stara notatka
`;

const stateVersion = () => getProject("a", TODAY).stateVersion;
const tasksVersion = () => getProject("a", TODAY).board.version;

describe("bc_projects services: Save State, devlog, type (zapis w vaulcie)", () => {
  const INPUT = {
    branch: "main",
    env: "local",
    blocker: "",
    nextStep: "krok",
    links: ["https://a"],
    milestone: "M",
    milestoneDue: "2026-12-01",
  };

  it("saveState: updated z now, notes zachowane, wersja przekazana", async () => {
    seedRegistry();
    vault.write(STATE_FILE, PREV_STATE);

    const result = await saveState("a", { ...INPUT, version: stateVersion() }, NOW);

    expect(vault.read(STATE_FILE)).toBe(`---
branch: main
env: local
blocker: ""
next_step: krok
links:
  - https://a
milestone: M
milestone_due: "2026-12-01"
updated: 2026-11-13T09:15
---

stara notatka
`);
    expect(result.id).toBe("a");
    expect(result.state?.updated).toBe("2026-11-13T09:15");
  });

  it("saveState bez poprzedniego pliku: notes pusty, plik powstaje", async () => {
    seedRegistry();

    await saveState("a", { ...INPUT, version: null }, NOW);

    expect(vault.read(STATE_FILE)).toBe(`---
branch: main
env: local
blocker: ""
next_step: krok
links:
  - https://a
milestone: M
milestone_due: "2026-12-01"
updated: 2026-11-13T09:15
---


`);
  });

  it("saveState: nieznany id bez zapisu", async () => {
    seedRegistry();

    await expect(saveState("zzz", { ...INPUT, version: null }, NOW)).rejects.toThrow(NotFoundError);

    expect(vault.read("Projects/zzz/state.md")).toBeNull();
  });

  it("saveState: zmiana pliku w międzyczasie to ConflictError, zmiana zewnętrzna zostaje", async () => {
    seedRegistry();
    vault.write(STATE_FILE, PREV_STATE);
    const version = stateVersion();
    vault.write(STATE_FILE, "---\nbranch: zewnętrzny\n---\n");

    await expect(saveState("a", { ...INPUT, version }, NOW)).rejects.toThrow(ConflictError);

    expect(vault.read(STATE_FILE)).toBe("---\nbranch: zewnętrzny\n---\n");
  });

  it("addDevlogEntry: wpis z datą now trafia do devlog.md", async () => {
    seedRegistry();

    const result = await addDevlogEntry("a", { title: "T", why: "W" }, new Date(2026, 10, 13));

    expect(vault.read(DEVLOG_FILE)).toBe("# Devlog\n\n## 2026-11-13 — T\n\nW\n");
    expect(result.devlog).toEqual([{ date: "2026-11-13", title: "T", why: "W" }]);
  });

  it("addDevlogEntry: nieznany id bez zapisu", async () => {
    seedRegistry();

    await expect(addDevlogEntry("zzz", { title: "T", why: "" })).rejects.toThrow(NotFoundError);

    expect(vault.read("Projects/zzz/devlog.md")).toBeNull();
  });

  it("setProjectType: zmienia tylko linię type w index.md", async () => {
    seedRegistry();
    vault.write(INDEX_FILE, "---\nname: A\ntype: etat\n---\n\nTreść\n");

    const result = await setProjectType("a", "wlasny", TODAY);

    expect(vault.read(INDEX_FILE)).toBe("---\nname: A\ntype: wlasny\n---\n\nTreść\n");
    expect(result.id).toBe("a");
  });

  it("setProjectType: nieznany id bez zapisu", async () => {
    seedRegistry();
    vault.write(INDEX_FILE, "---\nname: A\ntype: etat\n---\n");

    await expect(setProjectType("zzz", "etat")).rejects.toThrow(NotFoundError);

    expect(vault.read(INDEX_FILE)).toBe("---\nname: A\ntype: etat\n---\n");
  });
});

describe("bc_projects services: zadania projektu (zapis w tasks.md)", () => {
  const tasksText = (next: string[], now: string[] = []) =>
    [
      "# Tasks — A",
      "",
      "## Next",
      "",
      ...now.map((t) => `- [ ] ${t} [now::]`),
      ...next.map((t) => `- [ ] ${t}`),
      "",
    ].join("\n");
  const seedTasks = (text: string) => {
    seedRegistry();
    vault.write(TASKS_FILE, text);
  };
  const FULL_NOW = ["1", "2", "3"];

  it("toggle: zapis z wersją i datą dnia, wynik z getProject", async () => {
    seedTasks(tasksText(["A", "B"]));

    const result = await applyTaskOp(
      "a",
      { op: "toggle", column: "next", index: 1, text: "B" },
      tasksVersion(),
      NOW
    );

    expect(vault.read(TASKS_FILE)).toBe(
      "# Tasks — A\n\n## Next\n\n- [ ] A\n- [x] B — 2026-11-13\n"
    );
    expect(result.board.next).toEqual([
      { text: "A", done: false },
      { text: "B", done: true, doneDate: "2026-11-13" },
    ]);
  });

  it("inna wersja niż w pliku: ConflictError i plik bez zmian", async () => {
    seedTasks(tasksText(["A", "B"]));

    await expect(
      applyTaskOp(
        "a",
        { op: "toggle", column: "next", index: 0, text: "A" },
        { size: 1, hash: "x" },
        NOW
      )
    ).rejects.toThrow(ConflictError);

    expect(vault.read(TASKS_FILE)).toBe(tasksText(["A", "B"]));
  });

  it("niezgodny tekst lub indeks poza zakresem: ConflictError, plik bez zmian", async () => {
    seedTasks(tasksText(["A", "B"]));
    const version = tasksVersion();

    await expect(
      applyTaskOp("a", { op: "remove", column: "next", index: 0, text: "B" }, version, NOW)
    ).rejects.toThrow(ConflictError);
    await expect(
      applyTaskOp("a", { op: "remove", column: "next", index: 5, text: "A" }, version, NOW)
    ).rejects.toThrow(ConflictError);

    expect(vault.read(TASKS_FILE)).toBe(tasksText(["A", "B"]));
  });

  it("Teraz pełne: add i move do now to 422, plik bez zmian", async () => {
    seedTasks(tasksText(["A"], FULL_NOW));
    const version = tasksVersion();

    const add = applyTaskOp("a", { op: "add", column: "now", text: "x" }, version, NOW);
    await expect(add).rejects.toThrow(DomainError);
    await expect(add).rejects.toMatchObject({ statusCode: 422 });
    await expect(
      applyTaskOp("a", { op: "move", column: "next", index: 0, text: "A", to: "now" }, version, NOW)
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(vault.read(TASKS_FILE)).toBe(tasksText(["A"], FULL_NOW));
  });

  it("Teraz ma 2 zadania: add do now przechodzi i zadanie trafia do pliku", async () => {
    seedTasks(tasksText([], ["1", "2"]));

    await applyTaskOp("a", { op: "add", column: "now", text: "x" }, tasksVersion(), NOW);

    expect(vault.read(TASKS_FILE)).toBe(tasksText([], ["1", "2", "x"]));
  });

  it("move ukończonego zadania do now to 422, plik bez zmian", async () => {
    const text = "# Tasks — A\n\n## Next\n\n- [x] A — 2026-11-01\n";
    seedTasks(text);

    await expect(
      applyTaskOp(
        "a",
        { op: "move", column: "next", index: 0, text: "A", to: "now" },
        tasksVersion(),
        NOW
      )
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(vault.read(TASKS_FILE)).toBe(text);
  });

  it("move do tej samej kolumny to 422, plik bez zmian", async () => {
    seedTasks(tasksText(["A", "B"]));

    await expect(
      applyTaskOp(
        "a",
        { op: "move", column: "next", index: 0, text: "A", to: "next" },
        tasksVersion(),
        NOW
      )
    ).rejects.toMatchObject({ statusCode: 422 });

    expect(vault.read(TASKS_FILE)).toBe(tasksText(["A", "B"]));
  });

  it("add przy braku pliku: version null tworzy plik, version niepusta to ConflictError", async () => {
    seedRegistry();
    const stale: VersionToken = { size: 10, hash: "h1" };

    await expect(
      applyTaskOp("a", { op: "add", column: "next", text: "x" }, stale, NOW)
    ).rejects.toThrow(ConflictError);
    expect(vault.read(TASKS_FILE)).toBeNull();

    await applyTaskOp("a", { op: "add", column: "next", text: "x" }, null, NOW);

    expect(vault.read(TASKS_FILE)).toContain("- [ ] x");
  });

  it("toggle zadania z Teraz nie podlega limitowi, gdy Teraz jest pełne", async () => {
    seedTasks(tasksText([], FULL_NOW));

    await applyTaskOp(
      "a",
      { op: "toggle", column: "now", index: 0, text: "1" },
      tasksVersion(),
      NOW
    );

    expect(vault.read(TASKS_FILE)).toContain("- [x] 1 — 2026-11-13");
  });

  it("nieznany projekt: NotFoundError i brak pliku", async () => {
    seedRegistry();

    await expect(
      applyTaskOp("zzz", { op: "add", column: "next", text: "x" }, null, NOW)
    ).rejects.toThrow(NotFoundError);

    expect(vault.read("Projects/zzz/tasks.md")).toBeNull();
  });
});
