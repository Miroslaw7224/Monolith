// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  extractWikiLinks,
  parseNoteProjects,
  parseSharedSections,
  primaryCategory,
  readMapSources,
} from "@/contexts/bc_map/repositories";
import { useTempVault } from "../../helpers/tempVault";

const TECH_STACK = `# Wspólny stack

## OpenAI API — integracja

**Używają:** [[Projects/english-agent/english-agent|English Agent]], [[Projects/gen-podsum-ai/gen-podsum-ai|Gen Podsum AI]] (V2), [[Projects/code-sensei/code-sensei|Code Sensei]]

| Co | Gdzie działa |
| -- | ------------ |
| x  | y            |

## Deploy

| Co | Gdzie |
| -- | ----- |
| x  | y     |

## Supabase — wzorce

**Używają:** [[Projects/english-agent/english-agent|English Agent]]
`;

describe("parseSharedSections", () => {
  it("wyciąga id z linków z dopiskami poza ]], pomija sekcje bez linii Używają", () => {
    expect(parseSharedSections(TECH_STACK)).toEqual([
      ["english-agent", "gen-podsum-ai", "code-sensei"],
      ["english-agent"],
    ]);
  });
});

describe("parseNoteProjects", () => {
  it("zwraca niepuste teksty, ignoruje puste listy i niepoprawne typy", () => {
    expect(parseNoteProjects({ projects: ["nexus", " monolith ", "", 5] })).toEqual([
      "nexus",
      "monolith",
    ]);
    expect(parseNoteProjects({ projects: [] })).toEqual([]);
    expect(parseNoteProjects({ projects: "nexus" })).toEqual([]);
    expect(parseNoteProjects({})).toEqual([]);
  });
});

describe("extractWikiLinks", () => {
  it("obcina alias i kotwicę, pomija puste cele i bloki kodu, zachowuje duplikaty", () => {
    const text = "[[a]] [[b|alias]] [[c#h]] [[d#h|x]] [[ ]]\n```\n[[w-kodzie]]\n```\n[[e]] [[a]]";
    expect(extractWikiLinks(text)).toEqual(["a", "b", "c", "d", "e", "a"]);
  });
});

describe("primaryCategory", () => {
  it("bierze pierwszą wartość listy, małe litery, trim", () => {
    expect(primaryCategory({ categories: [" Dev-Tools ", "ai"] })).toBe("dev-tools");
  });
  it("obsługuje tekst z przecinkami; brak i pusta lista dają undefined", () => {
    expect(primaryCategory({ categories: "AI, x" })).toBe("ai");
    expect(primaryCategory({ categories: [] })).toBeUndefined();
    expect(primaryCategory({})).toBeUndefined();
  });
});

describe("readMapSources", () => {
  const vault = useTempVault();

  it("czyta notatki trzech obszarów; pomija _*, attachments/, Work/ i pliki bez katalogu projektu", () => {
    vault.write("tech-stack-wspolny.md", TECH_STACK);
    vault.write(
      "Knowledge/a.md",
      "---\nname: A\ncategories: [Dev-Tools, ai]\nprojects: [nexus, monolith]\n---\nZob. [[b]], [[Projects/nexus/nexus|NEXUS]] i [[b#kotwica]].\n```\n[[w-kodzie]]\n```\n"
    );
    vault.write("Knowledge/sub/b.md", "---\nname: B\nprojects: []\n---\n[[a]]");
    vault.write("Knowledge/sub/c.md", "bez frontmattera [[a]]");
    vault.write("Knowledge/_index.md", "idx");
    vault.write("Knowledge/sql/attachments/x.md", "att");
    vault.write("AI-2030/x.md", "x");
    vault.write("Projects/nexus/index.md", "i");
    vault.write("Projects/stray.md", "s");
    vault.write("Projects/Work/secret.md", "s");

    const sources = readMapSources();
    expect(sources.notes.map((n) => n.path)).toEqual([
      "AI-2030/x",
      "Knowledge/a",
      "Knowledge/sub/b",
      "Knowledge/sub/c",
      "Projects/nexus/index",
    ]);
    const byPath = Object.fromEntries(sources.notes.map((n) => [n.path, n]));
    expect(byPath["Knowledge/a"]).toMatchObject({
      area: "knowledge",
      title: "A",
      category: "dev-tools",
      projects: ["nexus", "monolith"],
      links: ["b", "Projects/nexus/nexus", "b"],
    });
    expect(byPath["Knowledge/sub/c"]).toMatchObject({ title: "c", links: ["a"], projects: [] });
    expect(byPath["Knowledge/sub/c"].category).toBeUndefined();
    expect(byPath["AI-2030/x"]).toMatchObject({ area: "ai2030", title: "x" });
    expect(byPath["Projects/nexus/index"]).toMatchObject({
      area: "project",
      projectId: "nexus",
      title: "index",
      projects: [],
    });
    expect(sources.sharedSections).toHaveLength(2);
    expect(sources.warnings).toEqual([]);
  });

  it("brak tech-stack-wspolny.md daje ostrzeżenie, nie wyjątek", () => {
    const sources = readMapSources();
    expect(sources.sharedSections).toEqual([]);
    expect(sources.notes).toEqual([]);
    expect(sources.warnings.join(" ")).toMatch(/tech-stack-wspolny\.md/);
  });
});
