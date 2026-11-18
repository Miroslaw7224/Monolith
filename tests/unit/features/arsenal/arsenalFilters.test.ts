import { describe, expect, it } from "vitest";
import type { ArsenalEntryDto, SkillCategoryDto } from "@/contexts/bc_arsenal/schemas";
import {
  catalogStats,
  EMPTY_FILTERS,
  entryProjects,
  filterEntries,
  isFiltered,
  promptModels,
} from "@/src/features/arsenal/arsenalFilters";

const skill = (
  slug: string,
  name: string,
  deployed: string[] = [],
  category?: SkillCategoryDto
): ArsenalEntryDto => ({
  kind: "skill",
  id: `skill:${slug}`,
  path: `Arsenal/Skills/${slug}/skill.md`,
  name,
  slug,
  summary: `Opis ${name}`,
  body: "",
  deployed: deployed.map((project) => ({ project, mode: "full" as const, date: "2026-11-14" })),
  templates: [],
  ...(category !== undefined && { category }),
});

const prompt = (
  key: string,
  name: string,
  projects: string[],
  model?: string
): ArsenalEntryDto => ({
  kind: "prompt",
  id: `prompt:${key}`,
  path: `Knowledge/prompty/${key}.md`,
  name,
  summary: `Opis ${name}`,
  body: "",
  projects,
  ...(model !== undefined && { model }),
});

const entries = [
  skill("tdd", "test-driven-development", ["p"], "testy"),
  skill("plans", "writing-plans", [], "planowanie"),
  prompt("Rada", "Rada Ekspertów", ["p", "q"], "opus"),
  prompt("Adwokat", "Adwokat Diabła", []),
];

const ids = (list: ArsenalEntryDto[]) => list.map((e) => e.id);

describe("filterEntries", () => {
  it("bez filtrów zwraca wszystko", () => {
    expect(filterEntries(entries, EMPTY_FILTERS)).toHaveLength(4);
  });

  it("szukanie ignoruje wielkość liter i polskie znaki, obejmuje nazwę i summary", () => {
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, query: "diabla" }))).toEqual([
      "prompt:Adwokat",
    ]);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, query: "OPIS WRITING" }))).toEqual([
      "skill:plans",
    ]);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, query: "nie ma takiego" }))).toEqual([]);
  });

  it("rodzaj", () => {
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, kind: "prompt" }))).toEqual([
      "prompt:Rada",
      "prompt:Adwokat",
    ]);
  });

  it("projekt: skille po deployed, prompty po projects", () => {
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, project: "p" }))).toEqual([
      "skill:tdd",
      "prompt:Rada",
    ]);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, project: "q" }))).toEqual([
      "prompt:Rada",
    ]);
  });

  it("model dotyczy tylko promptów", () => {
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, model: "opus" }))).toEqual([
      "prompt:Rada",
    ]);
  });

  it("kategoria: tylko skille z tą kategorią (prompty i skille bez kategorii odpadają)", () => {
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, category: "testy" }))).toEqual([
      "skill:tdd",
    ]);
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, category: "git" }))).toEqual([]);
  });

  it("niewdrożone nigdzie: tylko skille bez deployed", () => {
    expect(ids(filterEntries(entries, { ...EMPTY_FILTERS, undeployedOnly: true }))).toEqual([
      "skill:plans",
    ]);
  });
});

describe("catalogStats", () => {
  it("liczy skille, prompty i skille niewdrożone nigdzie", () => {
    expect(catalogStats(entries)).toEqual({ skills: 2, prompts: 2, undeployed: 1 });
    expect(catalogStats([])).toEqual({ skills: 0, prompts: 0, undeployed: 0 });
  });
});

describe("pomocnicze", () => {
  it("entryProjects", () => {
    expect(entryProjects(entries[0])).toEqual(["p"]);
    expect(entryProjects(entries[2])).toEqual(["p", "q"]);
  });

  it("promptModels: unikalne, niepuste, posortowane", () => {
    expect(promptModels([...entries, prompt("X", "X", [], "haiku")])).toEqual(["haiku", "opus"]);
  });

  it("isFiltered", () => {
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
    expect(isFiltered({ ...EMPTY_FILTERS, query: "a" })).toBe(true);
    expect(isFiltered({ ...EMPTY_FILTERS, undeployedOnly: true })).toBe(true);
    expect(isFiltered({ ...EMPTY_FILTERS, category: "git" })).toBe(true);
  });
});
