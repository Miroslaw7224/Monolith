// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, DomainError, NotFoundError } from "@/lib/errors";
import type { ProjectWithContent, TasksBoard, VersionToken } from "@/contexts/bc_projects/models";
import type { Note } from "@/contexts/bc_notes/models";
import type { Task } from "@/contexts/bc_tasks/models";
import type * as NotesServices from "@/contexts/bc_notes/services";
import type * as ProjectsServices from "@/contexts/bc_projects/services";
import type * as TasksServices from "@/contexts/bc_tasks/services";
import { setupTempVault } from "../../helpers/tempVault";

const mockGetProject = vi.hoisted(() => vi.fn<typeof ProjectsServices.getProject>());
const mockApplyTaskOp = vi.hoisted(() => vi.fn<typeof ProjectsServices.applyTaskOp>());
const mockCreateTask = vi.hoisted(() => vi.fn<typeof TasksServices.createTask>());
const mockCreateNote = vi.hoisted(() => vi.fn<typeof NotesServices.createNote>());
vi.mock(
  "@/contexts/bc_projects/services",
  () =>
    ({
      getProject: mockGetProject,
      applyTaskOp: mockApplyTaskOp,
    }) satisfies Partial<typeof ProjectsServices>
);
vi.mock(
  "@/contexts/bc_tasks/services",
  () => ({ createTask: mockCreateTask }) satisfies Partial<typeof TasksServices>
);
vi.mock(
  "@/contexts/bc_notes/services",
  () => ({ createNote: mockCreateNote }) satisfies Partial<typeof NotesServices>
);

import {
  addItem,
  clearClosed,
  countClosed,
  countOpen,
  detectType,
  listItems,
  moveItem,
  remove,
  resolve,
} from "@/contexts/bc_inbox/services";

const NOW = new Date(2026, 10, 13, 21, 5);

const vault = setupTempVault();
const INBOX = "Inbox/inbox.md";

/** Linia wpisu w tym formacie, w jakim zapisuje ją repozytorium. */
const line = (text: string, type = "myśl", mark = " ") =>
  `- [${mark}] ${text} [type:: ${type}] [at:: ]`;
const seed = (...lines: string[]) => vault.write(INBOX, `${lines.join("\n")}\n`);
/** Id otwartego wpisu o danym tekście, odczytane publicznym listItems. */
const idOf = (text: string) => listItems().find((i) => i.text === text)!.id;

const board = (version: VersionToken | null = null): TasksBoard => ({
  blockers: [],
  now: [],
  next: [],
  icebox: [],
  version,
});

const project = (over: Partial<ProjectWithContent> = {}): ProjectWithContent => ({
  id: "nexus",
  name: "NEXUS",
  status: "active",
  priority: "medium",
  folder: "Projects/nexus/",
  localPath: "",
  owner: "personal",
  whereIStopped: null,
  purpose: null,
  freshness: "fresh",
  tasks: [],
  board: board(),
  bugs: [],
  state: null,
  stateVersion: null,
  devlog: [],
  ...over,
});

const task = (o: Partial<Task> & Pick<Task, "id">): Task => ({
  title: "Zadanie",
  link: "",
  description: "",
  status: "todo",
  due_date: null,
  priority: null,
  ...o,
});

const note = (o: Partial<Note> & Pick<Note, "id">): Note => ({
  title: "Notatka",
  content: "",
  ...o,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("detectType", () => {
  it.each([
    ["https://vitest.dev/guide", "link", "https://vitest.dev/guide"],
    ["  http://x.pl  ", "link", "http://x.pl"],
    ["bug: pusta lista", "bug", "pusta lista"],
    ["Bug pusta lista", "bug", "pusta lista"],
    ["snippet: const a = 1", "snippet", "const a = 1"],
    ["kod: x[0]", "snippet", "x[0]"],
    ["Radar blokad w Mapie", "myśl", "Radar blokad w Mapie"],
    ["bugatti to auto", "myśl", "bugatti to auto"],
    ["zobacz https://x.pl", "myśl", "zobacz https://x.pl"],
  ])("%s → %s", (input, type, text) => {
    expect(detectType(input)).toEqual({ type, text });
  });
});

describe("addItem", () => {
  it("zapisuje wpis z typem i lokalnym znacznikiem czasu", async () => {
    const item = await addItem("bug: pusta lista", NOW);

    expect(vault.read(INBOX)).toBe("- [ ] pusta lista [type:: bug] [at:: 2026-11-13T21:05]\n");
    expect(item).toEqual({
      id: listItems()[0].id,
      text: "pusta lista",
      type: "bug",
      at: "2026-11-13T21:05",
    });
  });

  it("dopisuje na końcu istniejącego pliku, reszty nie zmienia", async () => {
    seed(line("pierwszy"));

    await addItem("drugi", NOW);

    expect(vault.read(INBOX)).toBe(
      "- [ ] pierwszy [type:: myśl] [at:: ]\n- [ ] drugi [type:: myśl] [at:: 2026-11-13T21:05]\n"
    );
  });

  it("zamienia nowe linie na spacje i przycina", async () => {
    await addItem("  a\n  b \r\n c ", NOW);

    expect(vault.read(INBOX)).toBe("- [ ] a b c [type:: myśl] [at:: 2026-11-13T21:05]\n");
  });

  it("pusty tekst, sam prefiks i tekst > 500 znaków to DomainError bez zapisu", async () => {
    await expect(addItem("  ", NOW)).rejects.toBeInstanceOf(DomainError);
    await expect(addItem("bug:", NOW)).rejects.toBeInstanceOf(DomainError);
    await expect(addItem("a".repeat(501), NOW)).rejects.toBeInstanceOf(DomainError);

    expect(vault.read(INBOX)).toBeNull();
  });
});

describe("listItems / countOpen / resolve", () => {
  it("najnowsze (z końca pliku) pierwsze; liczba otwartych", () => {
    seed(line("a"), line("b", "link"), line("zamknięty", "myśl", "x"));

    expect(listItems().map((i) => [i.text, i.type])).toEqual([
      ["b", "link"],
      ["a", "myśl"],
    ]);
    expect(countOpen()).toBe(2);
  });

  it("resolve zamyka wpis w pliku; nieznane id to NotFoundError i plik bez zmian", async () => {
    seed(line("a"), line("b"));
    const id = idOf("a");

    await expect(resolve(id)).resolves.toBeUndefined();
    expect(vault.read(INBOX)).toBe(`${line("a", "myśl", "x")}\n${line("b")}\n`);

    await expect(resolve("x")).rejects.toBeInstanceOf(NotFoundError);
    expect(vault.read(INBOX)).toBe(`${line("a", "myśl", "x")}\n${line("b")}\n`);
  });
});

describe("remove", () => {
  it("usuwa wpis z pliku; nieznane id to NotFoundError i plik bez zmian", async () => {
    seed(line("a"), line("b"));
    const id = idOf("a");

    await expect(remove(id)).resolves.toBeUndefined();
    expect(vault.read(INBOX)).toBe(`${line("b")}\n`);

    await expect(remove("x")).rejects.toBeInstanceOf(NotFoundError);
    expect(vault.read(INBOX)).toBe(`${line("b")}\n`);
  });
});

describe("countClosed / clearClosed", () => {
  it("countClosed liczy zamknięte wpisy w pliku", () => {
    seed(line("a", "myśl", "x"), line("b"), line("c", "myśl", "X"));

    expect(countClosed()).toBe(2);
  });

  it("clearClosed usuwa zamknięte, zwraca ich liczbę i zostawia otwarte", async () => {
    seed(line("a", "myśl", "x"), line("b"), line("c", "myśl", "X"));

    await expect(clearClosed()).resolves.toBe(2);

    expect(vault.read(INBOX)).toBe(`${line("b")}\n`);
  });
});

describe("moveItem", () => {
  const VERSION: VersionToken = { size: 10, hash: "abc" };
  const CLOSED = `${line("Wpis", "myśl", "x")}\n`;
  const OPEN = `${line("Wpis")}\n`;
  let id: string;

  beforeEach(() => {
    seed(line("Wpis"));
    id = idOf("Wpis");
    mockGetProject.mockReturnValue(project({ board: board(VERSION) }));
    mockApplyTaskOp.mockResolvedValue(project());
    mockCreateTask.mockResolvedValue(task({ id: "t1" }));
    mockCreateNote.mockResolvedValue(note({ id: "n1" }));
  });

  it("project/next: applyTaskOp z wersją pliku, potem [x]; ref = id projektu", async () => {
    const r = await moveItem(id, {
      target: "project",
      projectId: "nexus",
      column: "next",
      text: "Zrób X",
    });

    expect(mockGetProject).toHaveBeenCalledWith("nexus");
    expect(mockApplyTaskOp).toHaveBeenCalledWith(
      "nexus",
      { op: "add", column: "next", text: "Zrób X" },
      VERSION
    );
    expect(vault.read(INBOX)).toBe(CLOSED);
    expect(r).toEqual({ target: "project", ref: "nexus" });
  });

  it("project/icebox: kolumna trafia do applyTaskOp", async () => {
    await moveItem(id, {
      target: "project",
      projectId: "nexus",
      column: "icebox",
      text: "Kiedyś",
    });

    expect(mockApplyTaskOp.mock.calls[0][1]).toEqual({
      op: "add",
      column: "icebox",
      text: "Kiedyś",
    });
  });

  it("task: createTask z tytułem = tekst; ref = id zadania; wpis zamknięty", async () => {
    const r = await moveItem(id, { target: "task", text: "Kup mleko" });

    expect(mockCreateTask).toHaveBeenCalledWith({ title: "Kup mleko" });
    expect(vault.read(INBOX)).toBe(CLOSED);
    expect(r).toEqual({ target: "task", ref: "t1" });
  });

  it("note: createNote z tytułem i treścią; ref = id notatki; wpis zamknięty", async () => {
    const r = await moveItem(id, {
      target: "note",
      title: "Vitest",
      text: "https://vitest.dev",
    });

    expect(mockCreateNote).toHaveBeenCalledWith({
      title: "Vitest",
      content: "https://vitest.dev",
    });
    expect(vault.read(INBOX)).toBe(CLOSED);
    expect(r).toEqual({ target: "note", ref: "n1" });
  });

  it("wpis nieznany albo już zamknięty: NotFoundError, bez zapisu w celu", async () => {
    seed(line("Wpis", "myśl", "x"));

    await expect(moveItem(id, { target: "task", text: "a" })).rejects.toBeInstanceOf(NotFoundError);

    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(vault.read(INBOX)).toBe(CLOSED);
  });

  it("nieznany projekt (getProject rzuca NotFoundError): wpis nietknięty", async () => {
    mockGetProject.mockImplementation(() => {
      throw new NotFoundError("Nie ma projektu o id x");
    });

    await expect(
      moveItem(id, { target: "project", projectId: "x", column: "next", text: "a" })
    ).rejects.toBeInstanceOf(NotFoundError);

    expect(mockApplyTaskOp).not.toHaveBeenCalled();
    expect(vault.read(INBOX)).toBe(OPEN);
  });

  it("konflikt wersji tasks.md (applyTaskOp rzuca ConflictError): wpis nietknięty", async () => {
    mockApplyTaskOp.mockRejectedValue(new ConflictError("Plik zadań zmienił się w międzyczasie"));

    await expect(
      moveItem(id, { target: "project", projectId: "nexus", column: "next", text: "a" })
    ).rejects.toBeInstanceOf(ConflictError);

    expect(vault.read(INBOX)).toBe(OPEN);
  });

  it("limit „Teraz” itp. (DomainError z applyTaskOp) przechodzi dalej, wpis nietknięty", async () => {
    mockApplyTaskOp.mockRejectedValue(new DomainError("Limit 3 zadań w kolumnie Teraz", 422));

    await expect(
      moveItem(id, { target: "project", projectId: "nexus", column: "next", text: "a" })
    ).rejects.toBeInstanceOf(DomainError);

    expect(vault.read(INBOX)).toBe(OPEN);
  });

  it("błąd zapisu zadania ogólnego: wpis nietknięty", async () => {
    mockCreateTask.mockRejectedValue(new Error("disk"));

    await expect(moveItem(id, { target: "task", text: "a" })).rejects.toThrow("disk");

    expect(vault.read(INBOX)).toBe(OPEN);
  });

  it("inbox.md nie do zapisu po udanym zapisie w celu: wynik z ostrzeżeniem, cel istnieje", async () => {
    mockCreateTask.mockImplementation(async () => {
      // Podmiana pliku na katalog: kolejny zapis inboxu kończy się prawdziwym błędem.
      const abs = path.join(vault.root, INBOX);
      fs.rmSync(abs);
      fs.mkdirSync(abs);
      return task({ id: "t1" });
    });

    const r = await moveItem(id, { target: "task", text: "a" });

    expect(mockCreateTask).toHaveBeenCalledWith({ title: "a" });
    expect(r.target).toBe("task");
    expect(r.ref).toBe("t1");
    expect(r.warning).toMatch(/wpis zostaje otwarty/i);
  });

  it("wpis zniknął w międzyczasie: ostrzeżenie, nie błąd", async () => {
    mockCreateTask.mockImplementation(async () => {
      seed();
      return task({ id: "t1" });
    });

    const r = await moveItem(id, { target: "task", text: "a" });

    expect(r).toEqual({
      target: "task",
      ref: "t1",
      warning:
        "Zapisano w celu, ale nie udało się oznaczyć wpisu jako posegregowanego; wpis zostaje otwarty",
    });
  });
});
