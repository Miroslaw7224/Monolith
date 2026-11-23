// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "@/lib/errors";
import { readList } from "@/lib/nexus/yaml-store";
import type * as ProjectsServices from "@/contexts/bc_projects/services";
import { closeDay, MAX_FOCUS_TEXT, setPinned, setWeekFocus } from "@/contexts/bc_cockpit/services";
import { setupTempVault } from "../../helpers/tempVault";

const mockListGitActivity = vi.hoisted(() => vi.fn<typeof ProjectsServices.listGitActivity>());

// Git to granica procesu (TDD-5): atrapą są tylko commity dnia; rejestr projektów jest prawdziwy.
vi.mock("@/contexts/bc_projects/services", async (importOriginal) => ({
  ...(await importOriginal<typeof ProjectsServices>()),
  listGitActivity: mockListGitActivity,
}));

const vault = setupTempVault();
const PINNED = "Cockpit/pinned.yaml";
const CLOSING = "Cockpit/closing.yaml";
const WEEKS = "Cockpit/weeks.yaml";

/** 00:30 lokalnie: jedyna data „dziś” ma być 2026-11-13 (UTC byłoby 12-go). */
const TODAY = new Date(2026, 10, 13, 0, 30);

beforeEach(() => {
  mockListGitActivity.mockReset();
  mockListGitActivity.mockReturnValue([]);
  vault.write(
    "Projects/_registry.yaml",
    ["nexus", "monolith"].reduce(
      (text, id) =>
        `${text}  - id: ${id}\n    name: ${id}\n    status: active\n    folder: Projects/${id}/\n`,
      "projects:\n"
    )
  );
});

describe("setPinned", () => {
  it("zapisuje poprawną listę (kolejność zachowana) i zwraca ją", async () => {
    await expect(setPinned(["monolith", "nexus"])).resolves.toEqual({
      ids: ["monolith", "nexus"],
    });

    expect(readList(PINNED, "projects")).toEqual([{ id: "monolith" }, { id: "nexus" }]);
  });

  it("pusta lista jest dozwolona (odpięcie wszystkich)", async () => {
    await setPinned(["nexus"]);

    await expect(setPinned([])).resolves.toEqual({ ids: [] });

    expect(readList(PINNED, "projects")).toEqual([]);
  });

  it.each([
    ["nieznane id", ["nexus", "nie-ma"]],
    ["4 id", ["a", "b", "c", "d"]],
    ["duplikaty", ["nexus", "nexus"]],
  ])("%s: DomainError 400, nic nie zapisano", async (_name, ids) => {
    const err = await setPinned(ids).catch((e) => e);

    expect(err).toBeInstanceOf(DomainError);
    expect((err as DomainError).statusCode).toBe(400);
    expect(vault.read(PINNED)).toBeNull();
  });
});

describe("closeDay", () => {
  const entries = () => readList(CLOSING, "days");

  it("zapisuje dzisiejszą datę, przycięty tekst bez nowych linii i sumę commitów", async () => {
    mockListGitActivity.mockReturnValue([
      { projectId: "a", branch: null, commitsToday: 3 },
      { projectId: "b", branch: null, commitsToday: 2 },
    ]);

    const saved = await closeDay({ text: "  Zacząć\nod K6  ", projectId: null }, TODAY);

    expect(saved).toEqual({
      date: "2026-11-13",
      text: "Zacząć od K6",
      projectId: null,
      commits: 5,
    });
    expect(entries()).toEqual([{ date: "2026-11-13", text: "Zacząć od K6", commits: 5 }]);
  });

  it("brak dostępnych repo to brak commits, awaria gita nie blokuje zapisu", async () => {
    expect((await closeDay({ text: "x", projectId: null }, TODAY)).commits).toBeNull();
    mockListGitActivity.mockImplementation(() => {
      throw new Error("boom");
    });

    expect((await closeDay({ text: "y", projectId: null }, TODAY)).commits).toBeNull();

    // Ten sam dzień nadpisuje wpis.
    expect(entries()).toEqual([{ date: "2026-11-13", text: "y" }]);
  });

  it("zamknięcie innego dnia dopisuje się, a kolejność jest rosnąca po dacie", async () => {
    await closeDay({ text: "dziś", projectId: null }, TODAY);
    await closeDay({ text: "wczoraj", projectId: null }, new Date(2026, 10, 12, 12));

    expect(entries().map((e) => [e.date, e.text])).toEqual([
      ["2026-11-12", "wczoraj"],
      ["2026-11-13", "dziś"],
    ]);
  });

  it("znany projekt przechodzi i trafia do pliku, nieznany to DomainError bez zapisu", async () => {
    const ok = await closeDay({ text: "x", projectId: "nexus" }, TODAY);

    expect(ok.projectId).toBe("nexus");
    expect(entries()).toEqual([{ date: "2026-11-13", text: "x", project: "nexus" }]);
    await expect(closeDay({ text: "z", projectId: "nie-ma" }, TODAY)).rejects.toBeInstanceOf(
      DomainError
    );
    expect(entries()).toEqual([{ date: "2026-11-13", text: "x", project: "nexus" }]);
  });

  it("pusty tekst i tekst > 300 znaków to DomainError bez zapisu", async () => {
    await expect(closeDay({ text: " \n ", projectId: null }, TODAY)).rejects.toBeInstanceOf(
      DomainError
    );
    await expect(
      closeDay({ text: "a".repeat(301), projectId: null }, TODAY)
    ).rejects.toBeInstanceOf(DomainError);

    expect(vault.read(CLOSING)).toBeNull();
  });
});

describe("setWeekFocus", () => {
  it("zapisuje przycięte zdanie pod poniedziałkiem bieżącego tygodnia", async () => {
    const focus = await setWeekFocus({ text: "  Domknąć   słownik tagów " }, TODAY);

    expect(focus).toEqual({ weekStart: "2026-11-09", text: "Domknąć słownik tagów" });
    expect(readList(WEEKS, "weeks")).toEqual([
      { week_start: "2026-11-09", text: "Domknąć słownik tagów" },
    ]);
  });

  it("drugi zapis w tym samym tygodniu nadpisuje pierwszy", async () => {
    await setWeekFocus({ text: "Pierwszy" }, TODAY);
    await setWeekFocus({ text: "Drugi" }, new Date(2026, 10, 11, 12));

    expect(readList(WEEKS, "weeks")).toEqual([{ week_start: "2026-11-09", text: "Drugi" }]);
  });

  it("pusty tekst i same spacje to DomainError bez zapisu", async () => {
    await expect(setWeekFocus({ text: "" }, TODAY)).rejects.toThrow(DomainError);
    await expect(setWeekFocus({ text: "   " }, TODAY)).rejects.toThrow(DomainError);

    expect(vault.read(WEEKS)).toBeNull();
  });

  it("300 znaków przechodzi, 301 to DomainError", async () => {
    expect(MAX_FOCUS_TEXT).toBe(300);

    await expect(setWeekFocus({ text: "a".repeat(300) }, TODAY)).resolves.toEqual({
      weekStart: "2026-11-09",
      text: "a".repeat(300),
    });
    await expect(setWeekFocus({ text: "a".repeat(301) }, TODAY)).rejects.toThrow(DomainError);
  });
});
