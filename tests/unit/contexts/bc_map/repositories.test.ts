// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseNoteProjects,
  parseSharedSections,
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

describe("readMapSources", () => {
  const vault = useTempVault();

  it("czyta sekcje, projekty z notatek i liczby plików; pomija Work/", () => {
    vault.write("tech-stack-wspolny.md", TECH_STACK);
    vault.write("Knowledge/a.md", "---\nname: A\nprojects: [nexus, monolith]\n---\ntreść");
    vault.write("Knowledge/sub/b.md", "---\nname: B\nprojects: []\n---\ntreść");
    vault.write("Knowledge/sub/c.md", "bez frontmattera");
    vault.write("AI-2030/x.md", "x");
    vault.write("AI-2030/y.md", "y");
    vault.write("Projects/nexus/index.md", "i");
    vault.write("Projects/Work/secret.md", "s");

    const sources = readMapSources();
    expect(sources.sharedSections).toHaveLength(2);
    expect(sources.noteProjects).toEqual([["nexus", "monolith"]]);
    expect(sources.counts).toEqual({ knowledge: 3, ai2030: 2, projects: 1 });
    expect(sources.warnings).toEqual([]);
  });

  it("brak tech-stack-wspolny.md daje ostrzeżenie, nie wyjątek", () => {
    const sources = readMapSources();
    expect(sources.sharedSections).toEqual([]);
    expect(sources.warnings.join(" ")).toMatch(/tech-stack-wspolny\.md/);
    expect(sources.counts).toEqual({ knowledge: 0, ai2030: 0, projects: 0 });
  });
});
