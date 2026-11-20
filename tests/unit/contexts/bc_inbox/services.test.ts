// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConflictError, DomainError, NotFoundError } from "@/lib/errors";
import type { InboxItem } from "@/contexts/bc_inbox/models";
import type { ProjectWithContent, TasksBoard, VersionToken } from "@/contexts/bc_projects/models";
import type { Note } from "@/contexts/bc_notes/models";
import type { Task } from "@/contexts/bc_tasks/models";
import type * as InboxRepo from "@/contexts/bc_inbox/repositories";
import type * as NotesServices from "@/contexts/bc_notes/services";
import type * as ProjectsServices from "@/contexts/bc_projects/services";
import type * as TasksServices from "@/contexts/bc_tasks/services";

const mockRead = vi.hoisted(() => vi.fn<typeof InboxRepo.readOpenItems>());
const mockAppend = vi.hoisted(() => vi.fn<typeof InboxRepo.appendItem>());
const mockResolve = vi.hoisted(() => vi.fn<typeof InboxRepo.resolveItem>());
const mockRemove = vi.hoisted(() => vi.fn<typeof InboxRepo.removeItem>());
const mockCountClosed = vi.hoisted(() => vi.fn<typeof InboxRepo.countClosedItems>());
const mockRemoveClosed = vi.hoisted(() => vi.fn<typeof InboxRepo.removeClosedItems>());
vi.mock(
  "@/contexts/bc_inbox/repositories",
  () =>
    ({
      readOpenItems: mockRead,
      appendItem: mockAppend,
      resolveItem: mockResolve,
      removeItem: mockRemove,
      countClosedItems: mockCountClosed,
      removeClosedItems: mockRemoveClosed,
    }) satisfies Partial<typeof InboxRepo>
);

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

const inboxItem = (o: Partial<InboxItem> & Pick<InboxItem, "id">): InboxItem => ({
  text: "x",
  type: "myśl",
  at: null,
  ...o,
});

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
  mockAppend.mockImplementation(async (i) => ({ id: "h1", ...i }));
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
    expect(mockAppend).toHaveBeenCalledWith({
      text: "pusta lista",
      type: "bug",
      at: "2026-11-13T21:05",
    });
    expect(item).toEqual({
      id: "h1",
      text: "pusta lista",
      type: "bug",
      at: "2026-11-13T21:05",
    });
  });

  it("zamienia nowe linie na spacje i przycina", async () => {
    await addItem("  a\n  b \r\n c ", NOW);
    expect(mockAppend.mock.calls[0][0].text).toBe("a b c");
  });

  it("pusty tekst, sam prefiks i tekst > 500 znaków to DomainError bez zapisu", async () => {
    await expect(addItem("  ", NOW)).rejects.toBeInstanceOf(DomainError);
    await expect(addItem("bug:", NOW)).rejects.toBeInstanceOf(DomainError);
    await expect(addItem("a".repeat(501), NOW)).rejects.toBeInstanceOf(DomainError);
    expect(mockAppend).not.toHaveBeenCalled();
  });
});

describe("listItems / countOpen / resolve", () => {
  const items = [
    inboxItem({ id: "1", text: "a" }),
    inboxItem({ id: "2", text: "b", type: "link" }),
  ];

  it("najnowsze (z końca pliku) pierwsze; liczba otwartych", () => {
    mockRead.mockReturnValue(items);
    expect(listItems().map((i) => i.id)).toEqual(["2", "1"]);
    expect(countOpen()).toBe(2);
  });

  it("resolve: ok albo NotFoundError", async () => {
    mockResolve.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(resolve("1")).resolves.toBeUndefined();
    await expect(resolve("x")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("remove", () => {
  it("usuwa wpis albo rzuca NotFoundError", async () => {
    mockRemove.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(remove("1")).resolves.toBeUndefined();
    expect(mockRemove).toHaveBeenCalledWith("1");
    await expect(remove("x")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("countClosed / clearClosed", () => {
  it("countClosed zwraca liczbę zamkniętych z repozytorium", () => {
    mockCountClosed.mockReturnValue(3);
    expect(countClosed()).toBe(3);
  });

  it("clearClosed zwraca liczbę usuniętych", async () => {
    mockRemoveClosed.mockResolvedValue(2);
    await expect(clearClosed()).resolves.toBe(2);
  });
});

describe("moveItem", () => {
  const OPEN = [inboxItem({ id: "e1", text: "Wpis" })];
  const VERSION: VersionToken = { size: 10, hash: "abc" };

  beforeEach(() => {
    mockRead.mockReturnValue(OPEN);
    mockResolve.mockResolvedValue(true);
    mockGetProject.mockReturnValue(project({ board: board(VERSION) }));
    mockApplyTaskOp.mockResolvedValue(project());
    mockCreateTask.mockResolvedValue(task({ id: "t1" }));
    mockCreateNote.mockResolvedValue(note({ id: "n1" }));
  });

  it("project/next: applyTaskOp z wersją pliku, potem [x]; ref = id projektu", async () => {
    const r = await moveItem("e1", {
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
    expect(mockResolve).toHaveBeenCalledWith("e1");
    expect(r).toEqual({ target: "project", ref: "nexus" });
  });

  it("project/icebox: kolumna trafia do applyTaskOp", async () => {
    await moveItem("e1", {
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

  it("task: createTask z tytułem = tekst; ref = id zadania", async () => {
    const r = await moveItem("e1", { target: "task", text: "Kup mleko" });
    expect(mockCreateTask).toHaveBeenCalledWith({ title: "Kup mleko" });
    expect(mockResolve).toHaveBeenCalledWith("e1");
    expect(r).toEqual({ target: "task", ref: "t1" });
  });

  it("note: createNote z tytułem i treścią; ref = id notatki", async () => {
    const r = await moveItem("e1", {
      target: "note",
      title: "Vitest",
      text: "https://vitest.dev",
    });
    expect(mockCreateNote).toHaveBeenCalledWith({
      title: "Vitest",
      content: "https://vitest.dev",
    });
    expect(r).toEqual({ target: "note", ref: "n1" });
  });

  it("wpis nieznany albo już zamknięty: NotFoundError, bez zapisu w celu", async () => {
    mockRead.mockReturnValue([]);
    await expect(moveItem("e1", { target: "task", text: "a" })).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(mockCreateTask).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("nieznany projekt (getProject rzuca NotFoundError): wpis nietknięty", async () => {
    mockGetProject.mockImplementation(() => {
      throw new NotFoundError("Nie ma projektu o id x");
    });
    await expect(
      moveItem("e1", { target: "project", projectId: "x", column: "next", text: "a" })
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(mockApplyTaskOp).not.toHaveBeenCalled();
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("konflikt wersji tasks.md (applyTaskOp rzuca ConflictError): wpis nietknięty", async () => {
    mockApplyTaskOp.mockRejectedValue(new ConflictError("Plik zadań zmienił się w międzyczasie"));
    await expect(
      moveItem("e1", { target: "project", projectId: "nexus", column: "next", text: "a" })
    ).rejects.toBeInstanceOf(ConflictError);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("limit „Teraz” itp. (DomainError z applyTaskOp) przechodzi dalej, wpis nietknięty", async () => {
    mockApplyTaskOp.mockRejectedValue(new DomainError("Limit 3 zadań w kolumnie Teraz", 422));
    await expect(
      moveItem("e1", { target: "project", projectId: "nexus", column: "next", text: "a" })
    ).rejects.toBeInstanceOf(DomainError);
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("błąd zapisu zadania ogólnego: wpis nietknięty", async () => {
    mockCreateTask.mockRejectedValue(new Error("disk"));
    await expect(moveItem("e1", { target: "task", text: "a" })).rejects.toThrow("disk");
    expect(mockResolve).not.toHaveBeenCalled();
  });

  it("resolve rzuca po udanym zapisie: wynik z ostrzeżeniem, cel istnieje", async () => {
    mockResolve.mockRejectedValue(new Error("disk"));
    const r = await moveItem("e1", { target: "task", text: "a" });
    expect(mockCreateTask).toHaveBeenCalled();
    expect(r.target).toBe("task");
    expect(r.ref).toBe("t1");
    expect(r.warning).toMatch(/wpis zostaje otwarty/i);
  });

  it("resolve zwraca false (wpis zniknął w międzyczasie): też ostrzeżenie, nie błąd", async () => {
    mockResolve.mockResolvedValue(false);
    const r = await moveItem("e1", { target: "task", text: "a" });
    expect(r).toEqual({
      target: "task",
      ref: "t1",
      warning:
        "Zapisano w celu, ale nie udało się oznaczyć wpisu jako posegregowanego; wpis zostaje otwarty",
    });
  });
});
