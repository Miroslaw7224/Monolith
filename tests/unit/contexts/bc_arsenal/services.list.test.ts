// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ProjectsServices from "@/contexts/bc_projects/services";
import { setupTempVault } from "../../helpers/tempVault";

const mockListProjects = vi.hoisted(() => vi.fn<typeof ProjectsServices.listProjects>());
vi.mock("@/contexts/bc_projects/services", async (importOriginal) => {
  const actual = await importOriginal<typeof ProjectsServices>();
  return {
    listProjects: mockListProjects,
    hasCompanyData: actual.hasCompanyData,
  } satisfies Partial<typeof ProjectsServices>;
});

import * as services from "@/contexts/bc_arsenal/services";

type E = ReturnType<typeof ProjectsServices.listProjects>["projects"][number];
const entry = (o: Partial<E> = {}): E => ({
  id: "p",
  name: "Projekt P",
  status: "active",
  priority: "medium",
  folder: "Projects/p/",
  localPath: "~/p",
  owner: "personal",
  whereIStopped: null,
  purpose: null,
  freshness: "fresh",
  ...o,
});

const vault = setupTempVault();

beforeEach(() => {
  mockListProjects.mockReset();
  mockListProjects.mockReturnValue({
    projects: [
      entry({ id: "p", name: "Projekt P", localPath: "~/p", owner: "personal" }),
      entry({ id: "w", name: "Projekt W", localPath: "~/w", owner: "work" }),
    ],
    warnings: [],
  });
});

const skillDoc = (slug: string, extra = "") =>
  `---\nname: ${slug}\nslug: ${slug}\ntype: skill-doc\nsummary: Zasady ${slug}\n${extra}---\nTreść ${slug}\n`;

describe("truncate / firstSentence / firstBodyLine", () => {
  it("truncate zostawia do 90 znaków, dłuższe kończy wielokropkiem", () => {
    expect(services.truncate("krótki")).toBe("krótki");
    const cut = services.truncate("a".repeat(120));
    expect(cut).toHaveLength(90);
    expect(cut.endsWith("…")).toBe(true);
  });

  it("firstSentence bierze pierwsze zdanie albo całość", () => {
    expect(services.firstSentence("Pierwsze zdanie. Drugie zdanie.")).toBe("Pierwsze zdanie.");
    expect(services.firstSentence("Bez kropki")).toBe("Bez kropki");
  });

  it("firstBodyLine pomija puste linie, znaczniki nagłówków i separatory", () => {
    expect(services.firstBodyLine("\n\n---\n# Tytuł promptu\nreszta")).toBe("Tytuł promptu");
    expect(services.firstBodyLine("   \n")).toBe("");
  });
});

describe("parseDeployments", () => {
  it("akceptuje poprawne wpisy, liczy odrzucone", () => {
    const { valid, dropped } = services.parseDeployments([
      { project: "p", mode: "full", date: "2026-11-14" },
      { project: "p", mode: "zły", date: "2026-11-14" },
      "śmieć",
      { project: "", mode: "full", date: "2026-11-14" },
    ]);
    expect(valid).toEqual([{ project: "p", mode: "full", date: "2026-11-14" }]);
    expect(dropped).toBe(3);
  });

  it("brak pola to zero, nie-tablica to jedno odrzucenie", () => {
    expect(services.parseDeployments(undefined)).toEqual({ valid: [], dropped: 0 });
    expect(services.parseDeployments("x")).toEqual({ valid: [], dropped: 1 });
  });
});

describe("listArsenal: skille", () => {
  it("parsuje pola; deployed ograniczone do projektów z rejestru; skipped liczy odrzucone", () => {
    vault.write(
      "Arsenal/Skills/tdd/skill.md",
      skillDoc(
        "tdd",
        "origin: global\ndeployed:\n  - project: p\n    mode: full\n    date: 2026-11-14\n  - project: zniknal\n    mode: full\n    date: 2026-11-14\n"
      )
    );
    const { entries, skipped } = services.listArsenal();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "skill",
      id: "skill:tdd",
      path: "Arsenal/Skills/tdd/skill.md",
      name: "tdd",
      slug: "tdd",
      summary: "Zasady tdd",
      origin: "global",
      body: "Treść tdd\n",
      deployed: [{ project: "p", mode: "full", date: "2026-11-14" }],
    });
    expect(skipped).toBe(1);
  });

  it("category: znana kategoria trafia do wpisu, nieznana jest pomijana bez liczenia jako odrzucona", () => {
    vault.write("Arsenal/Skills/a/skill.md", skillDoc("a", "category: review\n"));
    vault.write("Arsenal/Skills/b/skill.md", skillDoc("b", "category: wymyslona\n"));
    vault.write("Arsenal/Skills/c/skill.md", skillDoc("c"));
    const { entries, skipped } = services.listArsenal();
    const category = (slug: string) =>
      (entries.find((e) => e.kind === "skill" && e.slug === slug) as { category?: string })
        .category;
    expect(category("a")).toBe("review");
    expect(category("b")).toBeUndefined();
    expect(category("c")).toBeUndefined();
    expect(skipped).toBe(0);
  });

  it("summary zastępcze: pierwsze zdanie description, ucięte do 90 znaków", () => {
    vault.write(
      "Arsenal/Skills/a/skill.md",
      "---\nname: a\nslug: a\ntype: skill-doc\ndescription: Pierwsze zdanie. Drugie zdanie.\n---\nx"
    );
    vault.write(
      "Arsenal/Skills/b/skill.md",
      `---\nname: b\nslug: b\ntype: skill-doc\ndescription: ${"a".repeat(120)}\n---\nx`
    );
    const [a, b] = services.listArsenal().entries;
    expect(a.summary).toBe("Pierwsze zdanie.");
    expect(b.summary).toHaveLength(90);
  });

  it("pomija pliki bez type skill-doc, z innym slugiem niż folder, bez frontmattera i bez name", () => {
    vault.write("Arsenal/Skills/ok/skill.md", skillDoc("ok"));
    vault.write("Arsenal/Skills/bad1/skill.md", "---\nname: bad1\nslug: bad1\ntype: inne\n---\nx");
    vault.write(
      "Arsenal/Skills/bad2/skill.md",
      "---\nname: bad2\nslug: inny\ntype: skill-doc\n---\nx"
    );
    vault.write("Arsenal/Skills/bad3/skill.md", "bez frontmattera");
    vault.write("Arsenal/Skills/bad4/skill.md", "---\nslug: bad4\ntype: skill-doc\n---\nx");
    const { entries, skipped } = services.listArsenal();
    expect(entries.map((e) => e.id)).toEqual(["skill:ok"]);
    expect(skipped).toBe(4);
  });

  it("dołącza szablony", () => {
    vault.write("Arsenal/Skills/a/skill.md", skillDoc("a"));
    vault.write("Arsenal/Skills/a/templates/t.md", "szablon");
    const [entry] = services.listArsenal().entries;
    expect(entry).toMatchObject({ templates: [{ name: "t.md", text: "szablon" }] });
  });
});

describe("listArsenal: prompty", () => {
  it("czyta prompty z Knowledge/prompty; summary z pierwszej linii; puste model pomijane", () => {
    vault.write(
      "Knowledge/prompty/Rada.md",
      "---\nname: Rada Ekspertów\nslug: rada\ntype: prompt\nmodel: ''\nprojects: [p]\n---\n\n\nRada ekspertów\nreszta"
    );
    vault.write("Knowledge/prompty/_index.md", "---\nname: Prompty\ntype: collection\n---\n# x");
    const { entries } = services.listArsenal();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      kind: "prompt",
      id: "prompt:Rada",
      name: "Rada Ekspertów",
      summary: "Rada ekspertów",
      projects: ["p"],
    });
    expect(entries[0]).not.toHaveProperty("model");
  });

  it("nazwa zastępcza to nazwa pliku", () => {
    vault.write("Knowledge/prompty/Bez_nazwy.md", "---\ntype: prompt\n---\ntreść");
    expect(services.listArsenal().entries[0].name).toBe("Bez_nazwy");
  });
});

describe("listArsenal: cele i kolejność", () => {
  it("targets to wszystkie projekty z rejestru, także z owner: work", () => {
    expect(services.listArsenal().targets).toEqual([
      { id: "p", name: "Projekt P", localPath: "~/p", owner: "personal", companyData: false },
      { id: "w", name: "Projekt W", localPath: "~/w", owner: "work", companyData: true },
    ]);
  });

  it("skille przed promptami, w obrębie rodzaju po nazwie", () => {
    vault.write("Arsenal/Skills/b/skill.md", skillDoc("b"));
    vault.write("Arsenal/Skills/a/skill.md", skillDoc("a"));
    vault.write("Knowledge/prompty/A.md", "---\ntype: prompt\n---\nx");
    expect(services.listArsenal().entries.map((e) => e.id)).toEqual([
      "skill:a",
      "skill:b",
      "prompt:A",
    ]);
  });
});
