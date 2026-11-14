# Notatki: baza wiedzy NEXUS (tylko odczyt) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Panel Notatki (Alt+5) dostaje drugą sekcję „Baza wiedzy NEXUS” z odczytem `Knowledge/` i swobodnych plików `Projects/<id>/` (drzewo, wyszukiwanie, tagi, podgląd z kartą frontmattera i klikalnymi wikilinkami), bez żadnej ścieżki zapisu do vaulta.

**Architecture:** Nowy kontekst `contexts/bc_nexus_docs/` (pięć plików, bez funkcji zapisu) wystawia `GET /api/nexus-docs` i `GET /api/nexus-docs/[...path]`. Serwis buduje listę widocznych ścieżek (D3, D9) i odczyt wolno wykonać tylko dla ścieżki z tej listy. UI: wtyczka `markdown-it` do wikilinków (`lib/markdown/wikilinks.ts`), czysty resolver po stronie klienta (`src/features/notes/nexusLinks.ts`) i trzy nowe pliki w `src/features/notes/`; stan wyboru NEXUS jest lokalny w `NotesPanel`.

**Tech Stack:** Next.js 14 (App Router), TypeScript, zod, markdown-it 14, `yaml` (przez `lib/nexus/frontmatter`), Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-14-notatki-nexus-odczyt-design.md` (zatwierdzony 2026-11-14). Gałąź: `feat/notatki-nexus`.

**Odstępstwo od specu (świadome):** spec §5 mówi o `src/translations.ts`, ale istniejący `NotesPanel` ma etykiety wpisane na stałe po polsku (np. „Szukaj notatki…”), a `t` dostaje tylko kilka propsów. Nowe etykiety NEXUS idą tak samo, na stałe po polsku w nowych komponentach (bez przepinania propsów). Gdyby użytkownik wolał `translations.ts`, to osobne, mechaniczne zadanie po wdrożeniu.

## Reguły wykonania (z `CLAUDE.md`)

- Zmiana `tests/unit/architecture.static.test.ts` **zawsze osobnym commitem, przed kodem** (Task 1). Nowy test statyczny z Task 2 też osobnym commitem. Pękający test naprawia się kodem, nie testem.
- Testy, lint, typecheck i build deleguj do `cursor` (`scripts/ask-helper.sh --role task --approve-allowed --tier light cursor "..."`), czytaj tylko podsumowanie. W krokach poniżej „Run” oznacza: uruchom sam pojedynczy plik testu (krótki output) albo zleć cursorowi, jeśli output byłby długi.
- Po zadaniach z większą zmianą (Task 6 i Task 12) poproś `agy --role review` o review diffa (zob. Task 13).
- Commity kończ linią `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Mapa plików

| Plik                                                                   | Akcja     | Odpowiedzialność                                                                         |
| ---------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------- |
| `tests/unit/architecture.static.test.ts`                               | modyfikuj | wpis w `VAULT_FS_IMPORTERS` (Task 1)                                                     |
| `tests/unit/contexts/bc_nexus_docs/readonly.static.test.ts`            | nowy      | gwarancja „tylko odczyt” (Task 2)                                                        |
| `contexts/bc_nexus_docs/models.ts`                                     | nowy      | typy i stałe domeny                                                                      |
| `contexts/bc_nexus_docs/schemas.ts`                                    | nowy      | zod, DTO, mapery (bezpieczne dla klienta)                                                |
| `contexts/bc_nexus_docs/repositories.ts`                               | nowy      | jedyny dostęp do vaulta (`listVaultFilesRecursive`, `readVaultFile`, `parseFrontmatter`) |
| `contexts/bc_nexus_docs/services.ts`                                   | nowy      | walidacja ścieżki, widoczność (D3, D9), tytuł, tagi, frontmatter, limit 1 MB             |
| `contexts/bc_nexus_docs/router.ts`                                     | nowy      | dwa handlery `GET`                                                                       |
| `app/api/nexus-docs/route.ts`, `app/api/nexus-docs/[...path]/route.ts` | nowy      | wyłącznie re-eksport `GET`                                                               |
| `lib/markdown/html-markdown.ts`                                        | modyfikuj | wyciągnięcie `createMarkdown()` (jedna konfiguracja `html: false`)                       |
| `lib/markdown/wikilinks.ts`                                            | nowy      | wtyczka `[[...]]` i `markdownToHtmlWithWikilinks`                                        |
| `src/features/notes/nexusLinks.ts`                                     | nowy      | czysty resolver wikilinków (D5)                                                          |
| `src/features/notes/nexusTree.ts`                                      | nowy      | filtr, grupowanie i tagi listy NEXUS                                                     |
| `src/features/notes/useNexusDocs.ts`                                   | nowy      | hooki `useNexusDocs` (lista) i `useNexusDoc` (treść)                                     |
| `src/features/notes/NexusDocsSection.tsx`                              | nowy      | sekcja w lewej kolumnie                                                                  |
| `src/features/notes/NexusDocView.tsx`                                  | nowy      | podgląd z kartą frontmattera                                                             |
| `src/features/notes/NotesPanel.tsx`                                    | modyfikuj | skład, lokalny `nexusPath`                                                               |
| `src/features/notes/notes.css`                                         | modyfikuj | style sekcji i wikilinków                                                                |
| `src/features/planowanie/PlanowanieView.tsx`                           | modyfikuj | przekazanie `apiFetch` do `NotesPanel`                                                   |

---

### Task 1: Test architektury (osobny commit, tylko test)

**Files:**

- Modify: `tests/unit/architecture.static.test.ts` (lista `VAULT_FS_IMPORTERS`)

- [ ] **Step 1: Dopisz wpis w posortowanej liście**

W `VAULT_FS_IMPORTERS` wstaw `"contexts/bc_nexus_docs/repositories",` między `"contexts/bc_mind_maps/repositories",` a `"contexts/bc_projects/repositories",`.

- [ ] **Step 2: Uruchom test i potwierdź, że jest czerwony z właściwego powodu**

Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: FAIL tylko w „zapis do vaulta (vault-fs) tylko ze znanych plików” (lista oczekiwana ma wpis, którego jeszcze nie ma w kodzie). Reszta zielona.

- [ ] **Step 3: Commit (tylko ten plik)**

```bash
git add tests/unit/architecture.static.test.ts
git commit -m "test(architektura): bc_nexus_docs/repositories w VAULT_FS_IMPORTERS (kontekst tylko do odczytu)

Czerwony do czasu dodania repositories kontekstu bc_nexus_docs (spec notatki-nexus D8).

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Test statyczny „tylko odczyt” (osobny commit, tylko test)

**Files:**

- Create: `tests/unit/contexts/bc_nexus_docs/readonly.static.test.ts`

- [ ] **Step 1: Napisz test**

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const CTX = "contexts/bc_nexus_docs";
const ROUTES = ["app/api/nexus-docs/route.ts", "app/api/nexus-docs/[...path]/route.ts"];
const WRITE_NAMES = [
  "writeVaultFile",
  "updateVaultFile",
  "deleteVaultFile",
  "createEntry",
  "updateEntry",
  "deleteEntry",
];
const WRITE_MODULES = ["markdown-dir", "yaml-store"];

const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function contextFiles(): string[] {
  const dir = path.join(ROOT, CTX);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: false })
    .map(String)
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => `${CTX}/${f.replace(/\\/g, "/")}`)
    .sort();
}

const read = (rel: string) => stripComments(fs.readFileSync(path.join(ROOT, rel), "utf8"));

describe("bc_nexus_docs jest tylko do odczytu", () => {
  const files = contextFiles();

  it("skanuje pięć plików kontekstu", () => {
    for (const name of ["models", "schemas", "repositories", "services", "router"]) {
      expect(files, name).toContain(`${CTX}/${name}.ts`);
    }
  });

  it("nie używa żadnej funkcji zapisu ani zapisujących modułów", () => {
    const found: string[] = [];
    for (const rel of files) {
      const text = read(rel);
      for (const name of WRITE_NAMES) if (text.includes(name)) found.push(`${rel}: ${name}`);
      for (const mod of WRITE_MODULES) if (text.includes(mod)) found.push(`${rel}: ${mod}`);
    }
    expect(found).toEqual([]);
  });

  it("nie importuje fs ani child_process", () => {
    const found: string[] = [];
    for (const rel of files) {
      if (/from\s+["'](?:node:)?(?:fs|child_process)/.test(read(rel))) found.push(rel);
    }
    expect(found).toEqual([]);
  });

  it("trasy wystawiają wyłącznie GET", () => {
    for (const rel of ROUTES) {
      expect(fs.existsSync(path.join(ROOT, rel)), rel).toBe(true);
      const text = read(rel);
      expect(text, rel).toMatch(/\bGET\b/);
      expect(text, rel).not.toMatch(/\b(?:POST|PUT|PATCH|DELETE)\b/);
    }
  });
});
```

- [ ] **Step 2: Uruchom i potwierdź czerwony**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs/readonly.static.test.ts`
Expected: FAIL („skanuje pięć plików kontekstu”, „trasy…”), bo kontekstu jeszcze nie ma.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/contexts/bc_nexus_docs/readonly.static.test.ts
git commit -m "test(nexus-docs): statyczna gwarancja, że kontekst i trasy są tylko do odczytu

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `models.ts` i `schemas.ts`

**Files:**

- Create: `contexts/bc_nexus_docs/models.ts`
- Create: `contexts/bc_nexus_docs/schemas.ts`
- Test: `tests/unit/contexts/bc_nexus_docs/schemas.test.ts`

- [ ] **Step 1: Napisz test schematów**

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  NexusDocDtoSchema,
  NexusDocPathParamsSchema,
  toDocDto,
  toSummaryDto,
} from "@/contexts/bc_nexus_docs/schemas";

const summary = {
  path: "Knowledge/a.md",
  area: "Knowledge" as const,
  group: "",
  title: "A",
  tags: ["x"],
};

describe("schemas bc_nexus_docs", () => {
  it("toSummaryDto kopiuje pola i tagi", () => {
    const dto = toSummaryDto(summary);
    expect(dto).toEqual(summary);
    expect(dto.tags).not.toBe(summary.tags);
  });

  it("toDocDto dodaje frontmatter i treść i przechodzi zod", () => {
    const dto = toDocDto({
      ...summary,
      frontmatter: [{ key: "title", value: "A" }],
      body: "treść",
    });
    expect(NexusDocDtoSchema.parse(dto)).toEqual(dto);
    expect(dto.body).toBe("treść");
  });

  it("parametr ścieżki: niepusta tablica napisów", () => {
    expect(NexusDocPathParamsSchema.safeParse({ path: ["Knowledge", "a.md"] }).success).toBe(true);
    expect(NexusDocPathParamsSchema.safeParse({ path: [] }).success).toBe(false);
    expect(NexusDocPathParamsSchema.safeParse({ path: "Knowledge/a.md" }).success).toBe(false);
    expect(NexusDocPathParamsSchema.safeParse({}).success).toBe(false);
  });
});
```

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs/schemas.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Napisz `models.ts`**

```ts
/** Obszary vaulta widoczne w panelu Notatki (tylko odczyt). */
export type NexusArea = "Knowledge" | "Projects";

export const NEXUS_AREAS: readonly NexusArea[] = ["Knowledge", "Projects"];

/** Pliki `Projects/<id>/` obsługiwane przez kartę Projekty; nie pokazujemy ich tutaj (spec D3). */
export const PROJECT_EXCLUDED_FILES: readonly string[] = [
  "index.md",
  "tasks.md",
  "bugs.md",
  "state.md",
  "ai-context.md",
  "devlog.md",
];

/** Treść dłuższa niż 1 MB daje 413 przy odczycie pojedynczego dokumentu. */
export const MAX_DOC_BYTES = 1_048_576;

export type NexusDocSummary = {
  /** Względem korzenia vaulta, np. `Knowledge/alembic.md`. */
  path: string;
  area: NexusArea;
  /** Podkatalog w `Knowledge/` albo id projektu; pusty dla plików luzem w `Knowledge/`. */
  group: string;
  title: string;
  tags: string[];
};

/** Para klucz–wartość frontmattera; wartość jest już tekstem (tablica YAML jako `[a, b]`). */
export type FrontmatterLine = { key: string; value: string };

export type NexusDoc = NexusDocSummary & {
  frontmatter: FrontmatterLine[];
  body: string;
};

/** Plik po odczycie i sparsowaniu frontmattera, jeszcze bez reguł domeny. */
export type RawNexusDoc = {
  path: string;
  meta: Record<string, unknown>;
  body: string;
  bytes: number;
};
```

- [ ] **Step 4: Napisz `schemas.ts`**

```ts
import { z } from "zod";
import type { NexusDoc, NexusDocSummary } from "./models";

export const NexusDocSummaryDtoSchema = z.object({
  path: z.string(),
  area: z.enum(["Knowledge", "Projects"]),
  group: z.string(),
  title: z.string(),
  tags: z.array(z.string()),
});

export const NexusDocDtoSchema = NexusDocSummaryDtoSchema.extend({
  frontmatter: z.array(z.object({ key: z.string(), value: z.string() })),
  body: z.string(),
});

/** Segmenty catch-all `[...path]`; właściwa walidacja i błędy 400 są w `services.ts`. */
export const NexusDocPathParamsSchema = z.object({ path: z.array(z.string()).min(1) });

export type NexusDocSummaryDto = z.infer<typeof NexusDocSummaryDtoSchema>;
export type NexusDocDto = z.infer<typeof NexusDocDtoSchema>;

export function toSummaryDto(doc: NexusDocSummary): NexusDocSummaryDto {
  return {
    path: doc.path,
    area: doc.area,
    group: doc.group,
    title: doc.title,
    tags: [...doc.tags],
  };
}

export function toDocDto(doc: NexusDoc): NexusDocDto {
  return {
    ...toSummaryDto(doc),
    frontmatter: doc.frontmatter.map((line) => ({ key: line.key, value: line.value })),
    body: doc.body,
  };
}
```

- [ ] **Step 5: Uruchom — zielony**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs/schemas.test.ts`
Expected: PASS (3 testy).

- [ ] **Step 6: Commit**

```bash
git add contexts/bc_nexus_docs/models.ts contexts/bc_nexus_docs/schemas.ts tests/unit/contexts/bc_nexus_docs/schemas.test.ts
git commit -m "feat(nexus-docs): modele i schematy DTO

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: `repositories.ts`

**Files:**

- Create: `contexts/bc_nexus_docs/repositories.ts`
- Test: `tests/unit/contexts/bc_nexus_docs/repositories.test.ts`

- [ ] **Step 1: Napisz test**

```ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { listNexusPaths, readNexusDoc } from "@/contexts/bc_nexus_docs/repositories";
import { useTempVault } from "../../helpers/tempVault";

const vault = useTempVault();

describe("listNexusPaths", () => {
  it("zwraca pliki .md z Knowledge i Projects, bez Notes, Work i dowiązań", () => {
    vault.write("Knowledge/a.md", "a");
    vault.write("Knowledge/sub/b.md", "b");
    vault.write("Knowledge/readme.txt", "x");
    vault.write("Projects/p/c.md", "c");
    vault.write("Notes/n.md", "n");
    vault.write("Work/secret.md", "s");
    vault.write("Knowledge/work/hidden.md", "h");
    fs.symlinkSync(path.join(vault.root, "Notes/n.md"), path.join(vault.root, "Knowledge/link.md"));
    expect(listNexusPaths()).toEqual(["Knowledge/a.md", "Knowledge/sub/b.md", "Projects/p/c.md"]);
  });

  it("brak katalogów daje pustą listę", () => {
    expect(listNexusPaths()).toEqual([]);
  });
});

describe("readNexusDoc", () => {
  it("parsuje frontmatter i zwraca treść bez niego", () => {
    vault.write("Knowledge/a.md", "---\ntitle: A\ntags: [x, y]\n---\nTreść\n");
    const raw = readNexusDoc("Knowledge/a.md");
    expect(raw?.meta).toEqual({ title: "A", tags: ["x", "y"] });
    expect(raw?.body).toBe("Treść\n");
    expect(raw?.path).toBe("Knowledge/a.md");
    expect(raw?.bytes).toBeGreaterThan(0);
  });

  it("plik bez frontmattera: pusty meta, cała treść w body", () => {
    vault.write("Knowledge/a.md", "# Tytuł\ntekst");
    const raw = readNexusDoc("Knowledge/a.md");
    expect(raw?.meta).toEqual({});
    expect(raw?.body).toBe("# Tytuł\ntekst");
  });

  it("błędny YAML traktuje jak brak frontmattera", () => {
    vault.write("Knowledge/a.md", "---\na: [unclosed\n---\ntreść");
    const raw = readNexusDoc("Knowledge/a.md");
    expect(raw?.meta).toEqual({});
    expect(raw?.body).toBe("---\na: [unclosed\n---\ntreść");
  });

  it("bytes liczy bajty UTF-8", () => {
    vault.write("Knowledge/a.md", "żółć");
    expect(readNexusDoc("Knowledge/a.md")?.bytes).toBe(Buffer.byteLength("żółć", "utf8"));
  });

  it("brak pliku daje null", () => {
    expect(readNexusDoc("Knowledge/nie-ma.md")).toBeNull();
  });

  it("niepoprawny UTF-8 daje null zamiast wyjątku", () => {
    vault.write("Knowledge/x.md", "x");
    fs.writeFileSync(path.join(vault.root, "Knowledge/bad.md"), Buffer.from([0xff, 0xfe, 0x41]));
    expect(readNexusDoc("Knowledge/bad.md")).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs/repositories.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Napisz `repositories.ts`**

```ts
import { DomainError } from "@/lib/errors";
import { parseFrontmatter } from "@/lib/nexus/frontmatter";
import { listVaultFilesRecursive, readVaultFile } from "@/lib/nexus/vault-fs";
import { NEXUS_AREAS, type RawNexusDoc } from "./models";

/**
 * Ścieżki `.md` z `Knowledge/` i `Projects/` (względem vaulta, posortowane w obrębie obszaru).
 * `listVaultFilesRecursive` pomija dowiązania i katalogi `Work`; filtr domenowy jest w `services`.
 */
export function listNexusPaths(): string[] {
  return NEXUS_AREAS.flatMap((area) => listVaultFilesRecursive(area));
}

/**
 * Odczyt i parsowanie frontmattera. `null`, gdy pliku nie ma albo nie da się go odczytać
 * (np. niepoprawny UTF-8); błędy domenowe (ścieżka, Work) lecą wyżej.
 */
export function readNexusDoc(rel: string): RawNexusDoc | null {
  let text: string;
  try {
    const file = readVaultFile(rel);
    if (file === null) return null;
    text = file.text;
  } catch (err) {
    if (err instanceof DomainError) throw err;
    return null;
  }
  const parsed = parseFrontmatter(text);
  return {
    path: rel,
    meta: parsed?.meta ?? {},
    body: parsed ? parsed.body : text,
    bytes: Buffer.byteLength(text, "utf8"),
  };
}
```

- [ ] **Step 4: Uruchom — zielony**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs/repositories.test.ts`
Expected: PASS (8 testów). Test architektury z Task 1 też powinien już przejść: `npx vitest run tests/unit/architecture.static.test.ts` (zielony; jeśli czerwony na R1–R7, popraw kod, nie test).

- [ ] **Step 5: Commit**

```bash
git add contexts/bc_nexus_docs/repositories.ts tests/unit/contexts/bc_nexus_docs/repositories.test.ts
git commit -m "feat(nexus-docs): repozytorium tylko do odczytu (lista ścieżek, odczyt z frontmatterem)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `services.ts` (walidacja, widoczność, tytuł, tagi, frontmatter, limit)

**Files:**

- Create: `contexts/bc_nexus_docs/services.ts`
- Test: `tests/unit/contexts/bc_nexus_docs/services.test.ts`

- [ ] **Step 1: Napisz test (czysta logika)**

Plik `services.test.ts`, część pierwsza:

````ts
// @vitest-environment node
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTempVault } from "../../helpers/tempVault";

const mockListProjects = vi.hoisted(() => vi.fn());
vi.mock("@/contexts/bc_projects/services", () => ({
  listProjects: mockListProjects,
  isWorkProject: (entry: { owner: string }) => entry.owner === "work",
}));

import { MAX_DOC_BYTES } from "@/contexts/bc_nexus_docs/models";
import * as services from "@/contexts/bc_nexus_docs/services";

const vault = useTempVault();

beforeEach(() => {
  mockListProjects.mockReset();
  mockListProjects.mockReturnValue({
    projects: [
      { id: "p", owner: "personal" },
      { id: "w", owner: "work" },
    ],
    warnings: [],
  });
});

const statusOf = (fn: () => unknown): number | undefined => {
  try {
    fn();
  } catch (err) {
    return (err as { statusCode?: number }).statusCode;
  }
  return undefined;
};

describe("parseDocPath (400)", () => {
  const bad: [string, string[]][] = [
    ["pusta", []],
    ["segment pusty (ścieżka absolutna)", ["", "etc", "passwd.md"]],
    ["kropka", ["Knowledge", ".", "a.md"]],
    ["..", ["Knowledge", "..", "a.md"]],
    ["Projects/id/../../Knowledge/x.md", ["Projects", "id", "..", "..", "Knowledge", "x.md"]],
    ["segment z /", ["Knowledge", "a/b.md"]],
    ["segment z \\", ["Knowledge", "a\\b.md"]],
    ["segment z \\0", ["Knowledge", "a\0.md"]],
    ["inny prefiks Notes", ["Notes", "x.md"]],
    ["Work jako prefiks", ["Work", "x.md"]],
    ["wielkość liter w prefiksie", ["knowledge", "x.md"]],
    ["bez .md", ["Knowledge", "x.txt"]],
    ["sam obszar", ["Knowledge"]],
  ];
  for (const [name, segments] of bad) {
    it(name, () => {
      expect(statusOf(() => services.parseDocPath(segments))).toBe(400);
    });
  }

  it("poprawna ścieżka jest łączona przez /", () => {
    expect(services.parseDocPath(["Knowledge", "ai-security", "foo.md"])).toBe(
      "Knowledge/ai-security/foo.md"
    );
    expect(services.parseDocPath(["Projects", "p", "decyzja.md"])).toBe("Projects/p/decyzja.md");
  });
});

describe("isVisiblePath", () => {
  const ids = new Set(["p"]);
  const cases: [string, boolean][] = [
    ["Knowledge/a.md", true],
    ["Knowledge/sub/deep/b.md", true],
    ["Knowledge/_index.md", false],
    ["Knowledge/sub/_tags.md", false],
    ["Knowledge/attachments/x.md", false],
    ["Knowledge/a.txt", false],
    ["Projects/p/decyzja.md", true],
    ["Projects/p/p.md", true],
    ["Projects/p/index.md", false],
    ["Projects/p/tasks.md", false],
    ["Projects/p/bugs.md", false],
    ["Projects/p/state.md", false],
    ["Projects/p/ai-context.md", false],
    ["Projects/p/devlog.md", false],
    ["Projects/p/_x.md", false],
    ["Projects/p/sub/x.md", false],
    ["Projects/loose.md", false],
    ["Projects/unknown/u.md", false],
    ["Notes/n.md", false],
  ];
  for (const [rel, expected] of cases) {
    it(`${rel} → ${expected}`, () => {
      expect(services.isVisiblePath(rel, ids)).toBe(expected);
    });
  }
});

describe("docGroup, docTitle, docTags, frontmatterLines", () => {
  it("group: podkatalog Knowledge, id projektu, pusty dla plików luzem", () => {
    expect(services.docGroup("Knowledge/a.md")).toBe("");
    expect(services.docGroup("Knowledge/ai-security/a.md")).toBe("ai-security");
    expect(services.docGroup("Knowledge/ai-security/deep/a.md")).toBe("ai-security");
    expect(services.docGroup("Projects/p/a.md")).toBe("p");
  });

  it("tytuł: title > name > pierwszy # > nazwa pliku", () => {
    expect(services.docTitle({ title: "T", name: "N" }, "# H", "Knowledge/f.md")).toBe("T");
    expect(services.docTitle({ name: "N" }, "# H", "Knowledge/f.md")).toBe("N");
    expect(services.docTitle({}, "wstęp\n\n# Nagłówek\n", "Knowledge/f.md")).toBe("Nagłówek");
    expect(services.docTitle({}, "brak nagłówka", "Knowledge/f.md")).toBe("f");
    expect(services.docTitle({ title: "  " }, "", "Knowledge/f.md")).toBe("f");
  });

  it("tytuł: nagłówek w bloku kodu jest pomijany", () => {
    expect(services.docTitle({}, "```\n# nie tytuł\n```\n# Prawdziwy", "Knowledge/f.md")).toBe(
      "Prawdziwy"
    );
  });

  it("tagi: tablica albo napis po przecinkach, reszta daje []", () => {
    expect(services.docTags({ tags: ["a", " b ", "", 3] })).toEqual(["a", "b"]);
    expect(services.docTags({ tags: "a, b ,," })).toEqual(["a", "b"]);
    expect(services.docTags({ tags: 5 })).toEqual([]);
    expect(services.docTags({})).toEqual([]);
  });

  it("frontmatter jako linie tekstowe", () => {
    expect(
      services.frontmatterLines({
        title: "A",
        tags: ["x", "y"],
        n: 3,
        ok: true,
        empty: null,
        obj: { a: 1 },
      })
    ).toEqual([
      { key: "title", value: "A" },
      { key: "tags", value: "[x, y]" },
      { key: "n", value: "3" },
      { key: "ok", value: "true" },
      { key: "empty", value: "" },
      { key: "obj", value: '{"a":1}' },
    ]);
  });
});
````

- [ ] **Step 2: Dopisz do tego samego pliku testy na vaulcie tymczasowym**

```ts
function seed() {
  vault.write("Knowledge/alembic.md", "---\ntitle: Alembic\ntags: [db, migracje]\n---\nTreść A\n");
  vault.write("Knowledge/ai-security/foo.md", "# Foo\ntekst");
  vault.write("Knowledge/_index.md", "x");
  vault.write("Knowledge/ai-security/_tags.md", "x");
  vault.write("Knowledge/attachments/img.md", "x");
  vault.write("Projects/p/p.md", "---\nname: Projekt P\n---\ntreść");
  vault.write("Projects/p/decyzja.md", "decyzja");
  for (const f of ["index", "tasks", "bugs", "state", "ai-context", "devlog"]) {
    vault.write(`Projects/p/${f}.md`, "x");
  }
  vault.write("Projects/p/sub/x.md", "x");
  vault.write("Projects/p/work/x.md", "x");
  vault.write("Projects/w/w.md", "dane etatu");
  vault.write("Projects/unknown/u.md", "x");
  vault.write("Projects/loose.md", "x");
  vault.write("Notes/n.md", "notatka");
  vault.write("Work/secret.md", "sekret");
  fs.symlinkSync(path.join(vault.root, "Notes/n.md"), path.join(vault.root, "Knowledge/link.md"));
  fs.symlinkSync(
    path.join(vault.root, "Projects/p/state.md"),
    path.join(vault.root, "Projects/p/alias.md")
  );
}

describe("listDocs", () => {
  it("zwraca tylko widoczne dokumenty, posortowane po area, group, title", () => {
    seed();
    const docs = services.listDocs();
    expect(docs.map((d) => d.path)).toEqual([
      "Knowledge/alembic.md",
      "Knowledge/ai-security/foo.md",
      "Projects/p/decyzja.md",
      "Projects/p/p.md",
    ]);
    expect(docs[0]).toEqual({
      path: "Knowledge/alembic.md",
      area: "Knowledge",
      group: "",
      title: "Alembic",
      tags: ["db", "migracje"],
    });
    expect(docs[3].title).toBe("Projekt P");
  });

  it("projekt owner: work nie trafia na listę (D9)", () => {
    seed();
    expect(services.listDocs().some((d) => d.path.startsWith("Projects/w/"))).toBe(false);
  });

  it("plik z niepoprawnym UTF-8 jest pominięty, lista się nie wywraca", () => {
    seed();
    fs.writeFileSync(path.join(vault.root, "Knowledge/bad.md"), Buffer.from([0xff, 0xfe, 0x41]));
    const paths = services.listDocs().map((d) => d.path);
    expect(paths).not.toContain("Knowledge/bad.md");
    expect(paths).toContain("Knowledge/alembic.md");
  });

  it("plik większy niż limit zostaje na liście (413 dopiero przy odczycie)", () => {
    seed();
    vault.write("Knowledge/big.md", "a".repeat(MAX_DOC_BYTES + 10));
    expect(services.listDocs().map((d) => d.path)).toContain("Knowledge/big.md");
  });
});

describe("getDoc", () => {
  it("zwraca dokument z frontmatterem i treścią", () => {
    seed();
    const doc = services.getDoc(["Knowledge", "alembic.md"]);
    expect(doc.title).toBe("Alembic");
    expect(doc.frontmatter).toEqual([
      { key: "title", value: "Alembic" },
      { key: "tags", value: "[db, migracje]" },
    ]);
    expect(doc.body).toBe("Treść A\n");
  });

  it("plik bez frontmattera i z błędnym YAML: pusty frontmatter, tags [], cała treść", () => {
    seed();
    vault.write("Knowledge/plain.md", "tekst bez frontmattera");
    vault.write("Knowledge/broken.md", "---\na: [unclosed\n---\ntreść");
    const plain = services.getDoc(["Knowledge", "plain.md"]);
    expect(plain.frontmatter).toEqual([]);
    expect(plain.tags).toEqual([]);
    expect(plain.body).toBe("tekst bez frontmattera");
    const broken = services.getDoc(["Knowledge", "broken.md"]);
    expect(broken.frontmatter).toEqual([]);
    expect(broken.body).toBe("---\na: [unclosed\n---\ntreść");
  });

  const notFound: [string, string[]][] = [
    ["brak pliku", ["Knowledge", "missing.md"]],
    ["state.md projektu", ["Projects", "p", "state.md"]],
    ["podkatalog projektu", ["Projects", "p", "sub", "x.md"]],
    ["katalog work w projekcie", ["Projects", "p", "work", "x.md"]],
    ["projekt owner: work", ["Projects", "w", "w.md"]],
    ["projekt spoza rejestru", ["Projects", "unknown", "u.md"]],
    ["plik _*", ["Knowledge", "_index.md"]],
    ["attachments", ["Knowledge", "attachments", "img.md"]],
    ["plik luzem w Projects", ["Projects", "loose.md"]],
    ["dowiązanie do Notes", ["Knowledge", "link.md"]],
    ["dowiązanie do state.md", ["Projects", "p", "alias.md"]],
  ];
  for (const [name, segments] of notFound) {
    it(`404: ${name}`, () => {
      seed();
      expect(statusOf(() => services.getDoc(segments))).toBe(404);
    });
  }

  it("400 ma pierwszeństwo przed 404 (Work/x.md)", () => {
    seed();
    expect(statusOf(() => services.getDoc(["Work", "secret.md"]))).toBe(400);
  });

  it("413 dla pliku większego niż 1 MB", () => {
    seed();
    vault.write("Knowledge/big.md", "a".repeat(MAX_DOC_BYTES + 10));
    expect(statusOf(() => services.getDoc(["Knowledge", "big.md"]))).toBe(413);
  });

  it("niepoprawny UTF-8 daje 404, nie 500", () => {
    seed();
    fs.writeFileSync(path.join(vault.root, "Knowledge/bad.md"), Buffer.from([0xff, 0xfe, 0x41]));
    expect(statusOf(() => services.getDoc(["Knowledge", "bad.md"]))).toBe(404);
  });
});
```

- [ ] **Step 3: Uruchom — czerwony**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs/services.test.ts`
Expected: FAIL (brak modułu `services`).

- [ ] **Step 4: Napisz `services.ts`**

````ts
import { isWorkProject, listProjects } from "@/contexts/bc_projects/services";
import { DomainError, NotFoundError } from "@/lib/errors";
import {
  MAX_DOC_BYTES,
  NEXUS_AREAS,
  PROJECT_EXCLUDED_FILES,
  type FrontmatterLine,
  type NexusArea,
  type NexusDoc,
  type NexusDocSummary,
  type RawNexusDoc,
} from "./models";
import { listNexusPaths, readNexusDoc } from "./repositories";

const cmp = (a: string, b: string): number => a.localeCompare(b, "pl");
const badRequest = (message: string) => new DomainError(message, 400);

/**
 * Segmenty catch-all → ścieżka względem vaulta. Rzuca 400 dla pustej ścieżki, pustego/`.`/`..`
 * segmentu, segmentu ze znakami `/`, `\` lub `\0` (np. po zdekodowaniu `%2F`), braku `.md`
 * oraz prefiksu innego niż dokładnie `Knowledge/` lub `Projects/` (wielkość liter rozróżniana).
 */
export function parseDocPath(segments: string[]): string {
  if (segments.length === 0) throw badRequest("Ścieżka dokumentu jest pusta");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === ".." || /[\\/\0]/.test(segment)) {
      throw badRequest("Nieprawidłowy segment ścieżki dokumentu");
    }
  }
  const joined = segments.join("/");
  if (!joined.endsWith(".md")) throw badRequest("Dozwolone są tylko pliki .md");
  if (segments.length < 2 || !NEXUS_AREAS.some((area) => area === segments[0])) {
    throw badRequest("Dozwolone obszary: Knowledge i Projects");
  }
  return joined;
}

/**
 * Reguła widoczności (D3, D9): `Knowledge/**` oraz `Projects/<id>/<plik>.md` dla projektów z rejestru
 * (bez `owner: work`), z wyłączeniem plików obsługiwanych przez kartę Projekty, plików `_*`
 * i katalogów `attachments/`. Działa na ścieżkach; nie czyta plików.
 */
export function isVisiblePath(rel: string, projectIds: ReadonlySet<string>): boolean {
  const segments = rel.split("/");
  const file = segments[segments.length - 1];
  if (segments.length < 2 || !file.endsWith(".md")) return false;
  if (file.startsWith("_") || segments.includes("attachments")) return false;
  if (segments[0] === "Knowledge") return true;
  if (segments[0] === "Projects") {
    return (
      segments.length === 3 && projectIds.has(segments[1]) && !PROJECT_EXCLUDED_FILES.includes(file)
    );
  }
  return false;
}

export function docGroup(rel: string): string {
  const segments = rel.split("/");
  if (segments[0] === "Projects") return segments[1] ?? "";
  return segments.length > 2 ? segments[1] : "";
}

export function docTitle(meta: Record<string, unknown>, body: string, rel: string): string {
  for (const key of ["title", "name"]) {
    const value = meta[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  const heading = /^#[ \t]+(\S.*?)[ \t]*$/m.exec(body.replace(/^```[\s\S]*?^```/gm, ""));
  if (heading) return heading[1];
  const file = rel.split("/").pop() ?? rel;
  return file.replace(/\.md$/, "");
}

export function docTags(meta: Record<string, unknown>): string[] {
  const value = meta.tags;
  const items = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return items
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function scalar(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function frontmatterLines(meta: Record<string, unknown>): FrontmatterLine[] {
  return Object.entries(meta).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? `[${value.map(scalar).join(", ")}]` : scalar(value),
  }));
}

function summarize(raw: RawNexusDoc): NexusDocSummary {
  return {
    path: raw.path,
    area: raw.path.split("/")[0] as NexusArea,
    group: docGroup(raw.path),
    title: docTitle(raw.meta, raw.body, raw.path),
    tags: docTags(raw.meta),
  };
}

function visibleProjectIds(): Set<string> {
  const { projects } = listProjects();
  return new Set(
    projects.filter((project) => !isWorkProject(project)).map((project) => project.id)
  );
}

/** Lista widocznych ścieżek: jedyne źródło prawdy dla listy i dla zgody na odczyt. */
function listVisiblePaths(): string[] {
  const ids = visibleProjectIds();
  return listNexusPaths().filter((rel) => isVisiblePath(rel, ids));
}

/** Podsumowania wszystkich widocznych dokumentów (bez treści). Nieczytelny plik jest pomijany. */
export function listDocs(): NexusDocSummary[] {
  const out: NexusDocSummary[] = [];
  for (const rel of listVisiblePaths()) {
    const raw = readNexusDoc(rel);
    if (raw !== null) out.push(summarize(raw));
  }
  return out.sort(
    (a, b) =>
      cmp(a.area, b.area) || cmp(a.group, b.group) || cmp(a.title, b.title) || cmp(a.path, b.path)
  );
}

/**
 * Jeden dokument. Najpierw składnia i prefiks (400), potem obecność na liście widocznych (404),
 * potem rozmiar (413). Odczyt spoza listy jest niemożliwy.
 */
export function getDoc(segments: string[]): NexusDoc {
  const rel = parseDocPath(segments);
  if (!listVisiblePaths().includes(rel)) throw new NotFoundError("Nie znaleziono dokumentu");
  const raw = readNexusDoc(rel);
  if (raw === null) throw new NotFoundError("Nie znaleziono dokumentu");
  if (raw.bytes > MAX_DOC_BYTES) throw new DomainError("Dokument jest zbyt duży", 413);
  return {
    ...summarize(raw),
    frontmatter: frontmatterLines(raw.meta),
    body: raw.body,
  };
}
````

- [ ] **Step 5: Uruchom — zielony**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs/services.test.ts`
Expected: PASS. Jeśli sortowanie w „zwraca tylko widoczne dokumenty” się nie zgadza, sprawdź kolejność: grupa pusta (`""`) przed `ai-security`, w `Projects/p` tytuł „decyzja” przed „Projekt P” (`localeCompare("pl")`). Poprawiaj kod, nie oczekiwanie, chyba że rachunek wyżej jest błędny.

- [ ] **Step 6: Sprawdź test architektury**

Run: `npx vitest run tests/unit/architecture.static.test.ts`
Expected: PASS (R2: `services` woła tylko `services` innego kontekstu; brak cyklu, bo `bc_projects` nie zna `bc_nexus_docs`).

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_nexus_docs/services.ts tests/unit/contexts/bc_nexus_docs/services.test.ts
git commit -m "feat(nexus-docs): serwis (walidacja ścieżki, widoczność D3/D9, tytuł, tagi, limit 1 MB)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: `router.ts` i trasy `app/api/nexus-docs`

**Files:**

- Create: `contexts/bc_nexus_docs/router.ts`
- Create: `app/api/nexus-docs/route.ts`
- Create: `app/api/nexus-docs/[...path]/route.ts`
- Test: `tests/unit/contexts/bc_nexus_docs/router.test.ts`

- [ ] **Step 1: Napisz test routera**

```ts
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DomainError, NotFoundError } from "@/lib/errors";

const mockListDocs = vi.hoisted(() => vi.fn());
const mockGetDoc = vi.hoisted(() => vi.fn());

vi.mock("@/contexts/bc_nexus_docs/services", () => ({
  listDocs: mockListDocs,
  getDoc: mockGetDoc,
}));

import { GET as listGET } from "@/app/api/nexus-docs/route";
import { GET as docGET } from "@/app/api/nexus-docs/[...path]/route";

beforeEach(() => {
  mockListDocs.mockReset();
  mockGetDoc.mockReset();
});

const req = new Request("http://localhost/api/nexus-docs");
const ctx = (path: unknown) => ({ params: Promise.resolve({ path }) }) as never;

describe("GET /api/nexus-docs", () => {
  it("zwraca podsumowania jako DTO", async () => {
    mockListDocs.mockReturnValue([
      { path: "Knowledge/a.md", area: "Knowledge", group: "", title: "A", tags: ["x"] },
    ]);
    const res = await listGET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([
      { path: "Knowledge/a.md", area: "Knowledge", group: "", title: "A", tags: ["x"] },
    ]);
  });

  it("błąd domeny mapuje na jego status", async () => {
    mockListDocs.mockImplementation(() => {
      throw new DomainError("boom", 400);
    });
    expect((await listGET()).status).toBe(400);
  });
});

describe("GET /api/nexus-docs/[...path]", () => {
  it("przekazuje segmenty do serwisu i zwraca dokument", async () => {
    mockGetDoc.mockReturnValue({
      path: "Knowledge/ai/a.md",
      area: "Knowledge",
      group: "ai",
      title: "A",
      tags: [],
      frontmatter: [{ key: "title", value: "A" }],
      body: "treść",
    });
    const res = await docGET(req, ctx(["Knowledge", "ai", "a.md"]));
    expect(res.status).toBe(200);
    expect(mockGetDoc).toHaveBeenCalledWith(["Knowledge", "ai", "a.md"]);
    const body = await res.json();
    expect(body.body).toBe("treść");
    expect(body.frontmatter).toEqual([{ key: "title", value: "A" }]);
  });

  it("brak dokumentu daje 404", async () => {
    mockGetDoc.mockImplementation(() => {
      throw new NotFoundError("nie ma");
    });
    expect((await docGET(req, ctx(["Knowledge", "x.md"]))).status).toBe(404);
  });

  it("413 z serwisu przechodzi bez zmian", async () => {
    mockGetDoc.mockImplementation(() => {
      throw new DomainError("za duży", 413);
    });
    expect((await docGET(req, ctx(["Knowledge", "x.md"]))).status).toBe(413);
  });

  it("niepoprawny parametr (nie tablica, pusta tablica) daje 400 bez wołania serwisu", async () => {
    expect((await docGET(req, ctx("Knowledge/a.md"))).status).toBe(400);
    expect((await docGET(req, ctx([]))).status).toBe(400);
    expect(mockGetDoc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs/router.test.ts`
Expected: FAIL (brak tras).

- [ ] **Step 3: Napisz `router.ts`**

```ts
import { NextResponse } from "next/server";
import { DomainError } from "@/lib/errors";
import { handleServiceError } from "@/lib/http/apiError";
import { NexusDocPathParamsSchema, toDocDto, toSummaryDto } from "./schemas";
import * as services from "./services";

type RouteContext = { params: Promise<{ path: string[] }> };

export async function listNexusDocs(): Promise<NextResponse> {
  try {
    return NextResponse.json(services.listDocs().map(toSummaryDto));
  } catch (err) {
    return handleServiceError(err);
  }
}

export async function getNexusDoc(_req: Request, ctx: RouteContext): Promise<NextResponse> {
  try {
    const parsed = NexusDocPathParamsSchema.safeParse(await ctx.params);
    if (!parsed.success) throw new DomainError("Nieprawidłowa ścieżka dokumentu", 400);
    return NextResponse.json(toDocDto(services.getDoc(parsed.data.path)));
  } catch (err) {
    return handleServiceError(err);
  }
}
```

- [ ] **Step 4: Napisz trasy (dokładnie jedna linia w każdej, reguła R4)**

`app/api/nexus-docs/route.ts`:

```ts
export { listNexusDocs as GET } from "@/contexts/bc_nexus_docs/router";
```

`app/api/nexus-docs/[...path]/route.ts`:

```ts
export { getNexusDoc as GET } from "@/contexts/bc_nexus_docs/router";
```

- [ ] **Step 5: Uruchom wszystkie testy kontekstu i architekturę**

Run: `npx vitest run tests/unit/contexts/bc_nexus_docs tests/unit/architecture.static.test.ts`
Expected: PASS wszystko, w tym `readonly.static.test.ts` z Task 2 i test z Task 1 (oba były czerwone przed kodem).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: bez błędów. (Jeśli `docGET(req, ctx(...))` w teście narzeka na typ kontekstu, `ctx` już zwraca `as never`.)

- [ ] **Step 7: Commit**

```bash
git add contexts/bc_nexus_docs/router.ts app/api/nexus-docs tests/unit/contexts/bc_nexus_docs/router.test.ts
git commit -m "feat(nexus-docs): trasy GET /api/nexus-docs i /api/nexus-docs/[...path]

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Wtyczka wikilinków (`lib/markdown`)

**Files:**

- Modify: `lib/markdown/html-markdown.ts`
- Create: `lib/markdown/wikilinks.ts`
- Test: `tests/unit/lib/markdown/wikilinks.test.ts`

- [ ] **Step 1: Napisz test**

````ts
import { describe, expect, it, vi } from "vitest";
import { markdownToHtmlWithWikilinks } from "@/lib/markdown/wikilinks";

const KNOWN: Record<string, string> = {
  "Knowledge/a": "Knowledge/a.md",
  "Knowledge/b": "Knowledge/b.md",
};
const resolve = (target: string): string | null => KNOWN[target] ?? null;
const render = (src: string) => markdownToHtmlWithWikilinks(src, resolve);

describe("wikilinki", () => {
  it("znany cel: link z data-nexus-path, bez celu w href", () => {
    const html = render("[[Knowledge/a]]");
    expect(html).toContain(
      '<a class="not-wikilink" href="#" data-nexus-path="Knowledge/a.md">Knowledge/a</a>'
    );
  });

  it("alias zastępuje etykietę, resolver dostaje sam cel", () => {
    const spy = vi.fn(resolve);
    const html = markdownToHtmlWithWikilinks("[[Knowledge/a|Alias]]", spy);
    expect(html).toContain(">Alias</a>");
    expect(spy).toHaveBeenCalledWith("Knowledge/a");
  });

  it("nagłówek po # nie trafia do celu, ale zostaje w etykiecie", () => {
    const spy = vi.fn(resolve);
    const html = markdownToHtmlWithWikilinks("[[Knowledge/a#sekcja]]", spy);
    expect(spy).toHaveBeenCalledWith("Knowledge/a");
    expect(html).toContain(">Knowledge/a#sekcja</a>");
  });

  it("nieznany cel: wyszarzony tekst z podpowiedzią", () => {
    expect(render("[[Nieznany]]")).toContain(
      '<span class="not-wikilink not-wikilink--missing" title="poza bazą NEXUS w tym panelu">Nieznany</span>'
    );
  });

  it("[[ bez zamknięcia i pusty cel zostają tekstem", () => {
    expect(render("[[ bez zamknięcia")).toContain("[[ bez zamknięcia");
    expect(render("[[ ]] i [[]]")).not.toContain("not-wikilink");
  });

  it("wstrzyknięcie w celu jest escapowane", () => {
    const html = render('[[a"><script>alert(1)</script>]]');
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("ścieżka z resolvera jest escapowana w atrybucie", () => {
    const html = markdownToHtmlWithWikilinks("[[x]]", () => 'a"><b>');
    expect(html).not.toContain("<b>");
    expect(html).toContain('data-nexus-path="a&quot;&gt;&lt;b&gt;"');
  });

  it("działa w komórce tabeli", () => {
    const html = render("| a |\n|---|\n| [[Knowledge/a]] |");
    expect(html).toContain('data-nexus-path="Knowledge/a.md"');
  });

  it("nie rusza code span ani bloku kodu", () => {
    const span = render("`[[Knowledge/a]]`");
    expect(span).toContain("<code>[[Knowledge/a]]</code>");
    expect(span).not.toContain("data-nexus-path");
    const block = render("```\n[[Knowledge/a]]\n```");
    expect(block).toContain("[[Knowledge/a]]");
    expect(block).not.toContain("data-nexus-path");
  });

  it("w tekście zwykłego linku zostaje zwykły tekst (bez zagnieżdżonego <a>)", () => {
    const html = render("[zobacz [[Knowledge/a]]](https://example.com)");
    expect(html).toContain("[[Knowledge/a]]");
    expect(html).not.toContain("data-nexus-path");
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("surowy HTML nadal jest escapowany (html: false)", () => {
    expect(render("<script>alert(1)</script>")).not.toContain("<script>");
  });

  it("pusty tekst daje pusty wynik", () => {
    expect(render("  ")).toBe("");
  });
});
````

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/lib/markdown/wikilinks.test.ts`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Wyciągnij `createMarkdown()` w `lib/markdown/html-markdown.ts`**

Zamień końcówkę pliku (od komentarza `// \`html: false\`…`):

```ts
// `html: false`: surowy HTML w źródle jest escapowany (E1); markdown-it odrzuca też linki `javascript:`.
// Jedyne miejsce konfiguracji: wtyczki (np. wikilinki) budują instancję przez tę funkcję.
export function createMarkdown(): MarkdownIt {
  return new MarkdownIt({ html: false, linkify: false, breaks: false });
}

const markdown = createMarkdown();

/** Markdown → HTML; pusty lub biały tekst daje "". */
export function markdownToHtml(source: string): string {
  if (source.trim() === "") return "";
  return markdown.render(source);
}
```

- [ ] **Step 4: Napisz `lib/markdown/wikilinks.ts`**

```ts
import type MarkdownIt from "markdown-it";
import { createMarkdown } from "./html-markdown";

/** `cel` (bez aliasu i `#nagłówka`) → ścieżka dokumentu albo `null`, gdy cel jest nieznany. */
export type WikiResolve = (target: string) => string | null;

type InlineRule = Parameters<MarkdownIt["inline"]["ruler"]["push"]>[1];
type InlineState = Parameters<InlineRule>[0];

const MISSING_TITLE = "poza bazą NEXUS w tym panelu";

/**
 * Reguła inline `[[cel|alias#nagłówek]]`. Jako reguła inline nie widzi bloków kodu ani code span,
 * a w tekście zwykłego linku `[...](...)` zostawia tekst (`linkLevel` > 0), żeby nie zagnieżdżać `<a>`.
 */
export function wikilinksPlugin(md: MarkdownIt, resolve: WikiResolve): void {
  const rule: InlineRule = (state: InlineState, silent: boolean) => {
    const src = state.src;
    const start = state.pos;
    if (src.charCodeAt(start) !== 0x5b || src.charCodeAt(start + 1) !== 0x5b) return false;
    const end = src.indexOf("]]", start + 2);
    if (end === -1 || end + 2 > state.posMax) return false;
    const inner = src.slice(start + 2, end);
    if (/[[\]\n]/.test(inner)) return false;
    const bar = inner.indexOf("|");
    const head = bar === -1 ? inner : inner.slice(0, bar);
    const alias = bar === -1 ? "" : inner.slice(bar + 1).trim();
    const target = head.split("#")[0].trim();
    if (target === "") return false;
    if (!silent) {
      const inLink = (state as unknown as { linkLevel: number }).linkLevel > 0;
      if (inLink) {
        const text = state.push("text", "", 0);
        text.content = src.slice(start, end + 2);
      } else {
        const token = state.push("wikilink", "", 0);
        token.content = alias !== "" ? alias : head.trim();
        token.meta = { path: resolve(target) };
      }
    }
    state.pos = end + 2;
    return true;
  };
  md.inline.ruler.before("link", "wikilink", rule);
  md.renderer.rules.wikilink = (tokens, idx) => {
    const token = tokens[idx];
    const label = md.utils.escapeHtml(token.content);
    const path = (token.meta as { path: string | null }).path;
    if (path === null) {
      return `<span class="not-wikilink not-wikilink--missing" title="${MISSING_TITLE}">${label}</span>`;
    }
    return `<a class="not-wikilink" href="#" data-nexus-path="${md.utils.escapeHtml(path)}">${label}</a>`;
  };
}

/** Markdown → HTML z wikilinkami rozwiązywanymi przez `resolve`; pusty tekst daje "". */
export function markdownToHtmlWithWikilinks(source: string, resolve: WikiResolve): string {
  if (source.trim() === "") return "";
  const md = createMarkdown();
  md.use(wikilinksPlugin, resolve);
  return md.render(source);
}
```

- [ ] **Step 5: Uruchom — zielony, plus istniejący test markdown**

Run: `npx vitest run tests/unit/lib/markdown`
Expected: PASS (nowe testy i istniejący `html-markdown.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add lib/markdown/html-markdown.ts lib/markdown/wikilinks.ts tests/unit/lib/markdown/wikilinks.test.ts
git commit -m "feat(markdown): wtyczka wikilinków [[cel|alias#nagłówek]] z resolverem

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Resolver wikilinków i pomocnicze funkcje listy (`src/features/notes`)

**Files:**

- Create: `src/features/notes/nexusLinks.ts`
- Create: `src/features/notes/nexusTree.ts`
- Test: `tests/unit/features/notes/nexusLinks.test.ts`
- Test: `tests/unit/features/notes/nexusTree.test.ts`

- [ ] **Step 1: Napisz testy**

`nexusLinks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createNexusResolver } from "@/src/features/notes/nexusLinks";

const paths = [
  "Knowledge/alembic.md",
  "Knowledge/ai-security/foo.md",
  "Projects/nexus/nexus.md",
  "Projects/nexus/decyzja.md",
];
const resolve = createNexusResolver(paths);

describe("createNexusResolver (D5)", () => {
  it("pełna ścieżka z .md i bez", () => {
    expect(resolve("Knowledge/alembic.md")).toBe("Knowledge/alembic.md");
    expect(resolve("Knowledge/alembic")).toBe("Knowledge/alembic.md");
    expect(resolve("Knowledge/ai-security/foo")).toBe("Knowledge/ai-security/foo.md");
  });

  it("fallback: prefiks Projects/ i Knowledge/", () => {
    expect(resolve("nexus/nexus")).toBe("Projects/nexus/nexus.md");
    expect(resolve("nexus/decyzja.md")).toBe("Projects/nexus/decyzja.md");
    expect(resolve("alembic")).toBe("Knowledge/alembic.md");
    expect(resolve("ai-security/foo")).toBe("Knowledge/ai-security/foo.md");
  });

  it("brak dopasowania po samej nazwie pliku w podkatalogu", () => {
    expect(resolve("foo")).toBeNull();
    expect(resolve("decyzja")).toBeNull();
  });

  it("cel spoza listy (np. wyłączony state.md albo Notes) daje null", () => {
    expect(resolve("Projects/nexus/state")).toBeNull();
    expect(resolve("Notes/n")).toBeNull();
    expect(resolve("")).toBeNull();
  });

  it("wielkość liter ma znaczenie", () => {
    expect(resolve("knowledge/alembic")).toBeNull();
  });
});
```

`nexusTree.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { collectNexusTags, filterNexusDocs, groupNexusDocs } from "@/src/features/notes/nexusTree";

const doc = (path: string, title: string, tags: string[] = []) => {
  const parts = path.split("/");
  return {
    path,
    area: parts[0] as "Knowledge" | "Projects",
    group: parts[0] === "Projects" ? parts[1] : parts.length > 2 ? parts[1] : "",
    title,
    tags,
  };
};

const docs = [
  doc("Knowledge/alembic.md", "Alembic", ["db", "migracje"]),
  doc("Knowledge/ai-security/foo.md", "Foo", ["db"]),
  doc("Projects/p/decyzja.md", "Decyzja", ["adr"]),
];

describe("filterNexusDocs", () => {
  it("po tytule i ścieżce, bez rozróżniania wielkości liter", () => {
    expect(filterNexusDocs(docs, "ALEM", null).map((d) => d.title)).toEqual(["Alembic"]);
    expect(filterNexusDocs(docs, "ai-security", null).map((d) => d.title)).toEqual(["Foo"]);
  });
  it("po tagu, także w połączeniu z tekstem", () => {
    expect(filterNexusDocs(docs, "", "db").map((d) => d.title)).toEqual(["Alembic", "Foo"]);
    expect(filterNexusDocs(docs, "foo", "db").map((d) => d.title)).toEqual(["Foo"]);
    expect(filterNexusDocs(docs, "", "brak")).toEqual([]);
  });
  it("puste zapytanie i brak tagu zwracają wszystko", () => {
    expect(filterNexusDocs(docs, "  ", null)).toHaveLength(3);
  });
});

describe("groupNexusDocs", () => {
  it("grupuje po obszarze i grupie, zachowując kolejność wejścia", () => {
    expect(groupNexusDocs(docs).map((f) => [f.label, f.docs.length])).toEqual([
      ["Knowledge/", 1],
      ["Knowledge/ai-security/", 1],
      ["Projects/p/", 1],
    ]);
  });
});

describe("collectNexusTags", () => {
  it("najpopularniejsze najpierw, remis alfabetycznie, z limitem", () => {
    expect(collectNexusTags(docs)).toEqual(["db", "adr", "migracje"]);
    expect(collectNexusTags(docs, 2)).toEqual(["db", "adr"]);
  });
});
```

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/features/notes/nexusLinks.test.ts tests/unit/features/notes/nexusTree.test.ts`
Expected: FAIL (brak modułów).

- [ ] **Step 3: Napisz `nexusLinks.ts`**

```ts
/**
 * Resolver wikilinków dokumentów NEXUS (spec D5). Czysta funkcja nad listą widocznych ścieżek.
 * Kolejność prób: cel jak podano, potem z prefiksem `Projects/`, potem `Knowledge/`; każda z `.md`
 * i bez. Dopasowanie tylko do ścieżki z listy (wielkość liter ma znaczenie), bez dopasowania po samej
 * nazwie pliku.
 */
export function createNexusResolver(paths: readonly string[]): (target: string) => string | null {
  const known = new Set(paths);
  return (target) => {
    const base = target.trim();
    if (base === "") return null;
    for (const prefix of ["", "Projects/", "Knowledge/"]) {
      const candidate = `${prefix}${base}`;
      const withExt = candidate.endsWith(".md") ? candidate : `${candidate}.md`;
      if (known.has(withExt)) return withExt;
    }
    return null;
  };
}
```

Uwaga: `candidate.endsWith(".md")` przy celu podanym z `.md` daje samą ścieżkę; bez `.md` dopisujemy rozszerzenie. Cel z `.md` nie jest próbowany bez rozszerzenia, bo `known` zawiera wyłącznie ścieżki `.md`.

- [ ] **Step 4: Napisz `nexusTree.ts`**

```ts
import type { NexusDocSummaryDto } from "@/contexts/bc_nexus_docs/schemas";

export type NexusFolder = { key: string; label: string; docs: NexusDocSummaryDto[] };

/** Filtr tekstowy (tytuł i ścieżka) połączony z filtrem tagu. */
export function filterNexusDocs(
  docs: NexusDocSummaryDto[],
  query: string,
  tag: string | null
): NexusDocSummaryDto[] {
  const q = query.trim().toLowerCase();
  return docs.filter((doc) => {
    if (q !== "" && !`${doc.title}\n${doc.path}`.toLowerCase().includes(q)) return false;
    return tag === null || doc.tags.includes(tag);
  });
}

/** Foldery w kolejności wejścia (API zwraca posortowane po obszarze, grupie i tytule). */
export function groupNexusDocs(docs: NexusDocSummaryDto[]): NexusFolder[] {
  const folders = new Map<string, NexusFolder>();
  for (const doc of docs) {
    const key = doc.group === "" ? doc.area : `${doc.area}/${doc.group}`;
    let folder = folders.get(key);
    if (!folder) {
      folder = { key, label: `${key}/`, docs: [] };
      folders.set(key, folder);
    }
    folder.docs.push(doc);
  }
  return [...folders.values()];
}

/** Najpopularniejsze tagi (malejąco po liczbie, remis alfabetycznie). */
export function collectNexusTags(docs: NexusDocSummaryDto[], limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const doc of docs) for (const tag of doc.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pl"))
    .slice(0, limit)
    .map(([tag]) => tag);
}
```

- [ ] **Step 5: Uruchom — zielony**

Run: `npx vitest run tests/unit/features/notes/nexusLinks.test.ts tests/unit/features/notes/nexusTree.test.ts`
Expected: PASS. (`collectNexusTags`: db=2, adr=1, migracje=1 → `["db","adr","migracje"]`.)

- [ ] **Step 6: Commit**

```bash
git add src/features/notes/nexusLinks.ts src/features/notes/nexusTree.ts tests/unit/features/notes/nexusLinks.test.ts tests/unit/features/notes/nexusTree.test.ts
git commit -m "feat(notatki): resolver wikilinków NEXUS oraz filtr, grupowanie i tagi listy

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Hooki `useNexusDocs` i `useNexusDoc`

**Files:**

- Create: `src/features/notes/useNexusDocs.ts`
- Test: `tests/unit/features/notes/useNexusDocs.test.tsx`

- [ ] **Step 1: Napisz test**

```tsx
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNexusDoc, useNexusDocs } from "@/src/features/notes/useNexusDocs";

afterEach(() => cleanup());

const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 500, json: async () => body }) as Response;

const LIST = [{ path: "Knowledge/a.md", area: "Knowledge", group: "", title: "A", tags: [] }];

describe("useNexusDocs", () => {
  it("pobiera listę z /api/nexus-docs", async () => {
    const apiFetch = vi.fn(async () => json(LIST));
    const { result } = renderHook(() => useNexusDocs(apiFetch));
    await waitFor(() => expect(result.current.docs).toHaveLength(1));
    expect(apiFetch).toHaveBeenCalledWith("/api/nexus-docs");
    expect(result.current.error).toBeNull();
  });

  it("bez apiFetch nic nie pobiera", () => {
    const { result } = renderHook(() => useNexusDocs(undefined));
    expect(result.current.docs).toEqual([]);
  });

  it("błąd odpowiedzi daje pustą listę i komunikat", async () => {
    const apiFetch = vi.fn(async () => json({ error: "x" }, false));
    const { result } = renderHook(() => useNexusDocs(apiFetch));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.docs).toEqual([]);
  });
});

describe("useNexusDoc", () => {
  const DOC = { ...LIST[0], frontmatter: [], body: "treść" };

  it("pobiera dokument, kodując segmenty ścieżki", async () => {
    const apiFetch = vi.fn(async () => json({ ...DOC, path: "Knowledge/a b.md" }));
    const { result } = renderHook(() => useNexusDoc(apiFetch, "Knowledge/a b.md"));
    await waitFor(() => expect(result.current.doc).not.toBeNull());
    expect(apiFetch).toHaveBeenCalledWith("/api/nexus-docs/Knowledge/a%20b.md");
    expect(result.current.loading).toBe(false);
  });

  it("brak ścieżki: nic nie pobiera", () => {
    const apiFetch = vi.fn(async () => json(DOC));
    const { result } = renderHook(() => useNexusDoc(apiFetch, null));
    expect(result.current.doc).toBeNull();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("404 daje komunikat błędu", async () => {
    const apiFetch = vi.fn(async () => json({ error: "nie ma" }, false));
    const { result } = renderHook(() => useNexusDoc(apiFetch, "Knowledge/x.md"));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.doc).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/features/notes/useNexusDocs.test.tsx`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Napisz `useNexusDocs.ts`**

```ts
import { useEffect, useState } from "react";
import type { NexusDocDto, NexusDocSummaryDto } from "@/contexts/bc_nexus_docs/schemas";

export type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

const LIST_ERROR = "Nie udało się wczytać bazy NEXUS";
const DOC_ERROR = "Dokument jest niedostępny";

/** Lista dokumentów NEXUS (jedno zapytanie, bez treści). Bez `apiFetch` nic nie pobiera. */
export function useNexusDocs(apiFetch: ApiFetch | undefined): {
  docs: NexusDocSummaryDto[];
  error: string | null;
} {
  const [docs, setDocs] = useState<NexusDocSummaryDto[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiFetch) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/nexus-docs");
        const data: unknown = await res.json();
        if (cancelled) return;
        if (!res.ok || !Array.isArray(data)) {
          setDocs([]);
          setError(LIST_ERROR);
          return;
        }
        setDocs(data as NexusDocSummaryDto[]);
        setError(null);
      } catch {
        if (cancelled) return;
        setDocs([]);
        setError(LIST_ERROR);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  return { docs, error };
}

/** Treść jednego dokumentu po otwarciu. `path` = ścieżka względem vaulta albo `null`. */
export function useNexusDoc(
  apiFetch: ApiFetch,
  path: string | null
): { doc: NexusDocDto | null; loading: boolean; error: string | null } {
  const [doc, setDoc] = useState<NexusDocDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDoc(null);
    setError(null);
    if (path === null) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = `/api/nexus-docs/${path.split("/").map(encodeURIComponent).join("/")}`;
        const res = await apiFetch(url);
        const data: unknown = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(DOC_ERROR);
        } else {
          setDoc(data as NexusDocDto);
        }
      } catch {
        if (!cancelled) setError(DOC_ERROR);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiFetch, path]);

  return { doc, loading, error };
}
```

- [ ] **Step 4: Uruchom — zielony**

Run: `npx vitest run tests/unit/features/notes/useNexusDocs.test.tsx`
Expected: PASS (6 testów).

- [ ] **Step 5: Commit**

```bash
git add src/features/notes/useNexusDocs.ts tests/unit/features/notes/useNexusDocs.test.tsx
git commit -m "feat(notatki): hooki pobierania listy i treści dokumentów NEXUS

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: `NexusDocsSection` i style

**Files:**

- Create: `src/features/notes/NexusDocsSection.tsx`
- Modify: `src/features/notes/notes.css` (dopisz na końcu)
- Test: `tests/unit/features/notes/NexusDocsSection.test.tsx`

- [ ] **Step 1: Napisz test**

```tsx
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexusDocsSection } from "@/src/features/notes/NexusDocsSection";

afterEach(() => cleanup());

const docs = [
  {
    path: "Knowledge/alembic.md",
    area: "Knowledge" as const,
    group: "",
    title: "Alembic",
    tags: ["db"],
  },
  {
    path: "Knowledge/ai/foo.md",
    area: "Knowledge" as const,
    group: "ai",
    title: "Foo",
    tags: ["db", "ai"],
  },
  {
    path: "Projects/p/decyzja.md",
    area: "Projects" as const,
    group: "p",
    title: "Decyzja",
    tags: [],
  },
];

const names = (c: HTMLElement) =>
  [...c.querySelectorAll(".not-nexus .not-file__name")].map((n) => n.textContent);

function setup(over: Partial<React.ComponentProps<typeof NexusDocsSection>> = {}) {
  const onSelect = vi.fn();
  const utils = render(
    <NexusDocsSection docs={docs} error={null} selectedPath={null} onSelect={onSelect} {...over} />
  );
  return { onSelect, ...utils };
}

describe("NexusDocsSection", () => {
  it("pokazuje nagłówek z plakietką tylko do odczytu i liczbę dokumentów", () => {
    const { container, getByLabelText } = setup();
    expect(getByLabelText("Baza wiedzy NEXUS")).toBeTruthy();
    expect(container.querySelector(".not-nexus .not-sidebar__title")?.textContent).toContain(
      "tylko odczyt"
    );
    expect(container.querySelector(".not-nexus .not-chip")?.textContent).toBe("3");
  });

  it("foldery są domyślnie zwinięte; klik w nagłówek je rozwija", () => {
    const { container, getByText } = setup();
    expect(names(container)).toEqual([]);
    fireEvent.click(getByText(/Knowledge\/ai\//));
    expect(names(container)).toEqual(["Foo"]);
  });

  it("wyszukiwanie rozwija foldery i filtruje po tytule", () => {
    const { container, getByLabelText } = setup();
    fireEvent.change(getByLabelText("Filtruj bazę NEXUS"), { target: { value: "alem" } });
    expect(names(container)).toEqual(["Alembic"]);
  });

  it("tag filtruje dokumenty i działa jak przełącznik", () => {
    const { container, getByText } = setup();
    fireEvent.click(getByText("#ai"));
    expect(names(container)).toEqual(["Foo"]);
    fireEvent.click(getByText("#ai"));
    expect(names(container)).toEqual([]);
  });

  it("klik w dokument woła onSelect ze ścieżką i oznacza aktywny", () => {
    const { container, getByLabelText, onSelect, rerender } = setup();
    fireEvent.change(getByLabelText("Filtruj bazę NEXUS"), { target: { value: "alem" } });
    fireEvent.click(container.querySelector(".not-nexus .not-file") as HTMLElement);
    expect(onSelect).toHaveBeenCalledWith("Knowledge/alembic.md");
    rerender(
      <NexusDocsSection
        docs={docs}
        error={null}
        selectedPath="Knowledge/alembic.md"
        onSelect={onSelect}
      />
    );
    expect(container.querySelector(".not-nexus .not-file--active")).not.toBeNull();
  });

  it("zaznaczony dokument rozwija swój folder", () => {
    const { container } = setup({ selectedPath: "Knowledge/ai/foo.md" });
    expect(names(container)).toEqual(["Foo"]);
  });

  it("stany: błąd, pusta baza, brak wyników", () => {
    const err = setup({ error: "Nie udało się wczytać bazy NEXUS" });
    expect(err.container.textContent).toContain("Nie udało się wczytać bazy NEXUS");
    cleanup();
    const empty = setup({ docs: [] });
    expect(empty.container.textContent).toContain("Brak dokumentów NEXUS");
    cleanup();
    const none = setup();
    fireEvent.change(none.getByLabelText("Filtruj bazę NEXUS"), { target: { value: "zzz" } });
    expect(none.container.textContent).toContain("Brak wyników");
  });
});
```

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/features/notes/NexusDocsSection.test.tsx`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Napisz `NexusDocsSection.tsx`**

```tsx
import React, { useMemo, useState } from "react";
import type { NexusDocSummaryDto } from "@/contexts/bc_nexus_docs/schemas";
import { cn } from "@/src/lib/cn";
import { collectNexusTags, filterNexusDocs, groupNexusDocs } from "./nexusTree";

export interface NexusDocsSectionProps {
  docs: NexusDocSummaryDto[];
  error: string | null;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

/** Sekcja „Baza wiedzy NEXUS” w lewej kolumnie panelu Notatki (tylko odczyt). */
export function NexusDocsSection({ docs, error, selectedPath, onSelect }: NexusDocsSectionProps) {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  const visible = useMemo(() => filterNexusDocs(docs, query, activeTag), [docs, query, activeTag]);
  const folders = useMemo(() => groupNexusDocs(visible), [visible]);
  const tags = useMemo(() => collectNexusTags(docs), [docs]);
  const forceOpen = query.trim() !== "" || activeTag !== null;

  return (
    <section className="not-nexus" aria-label="Baza wiedzy NEXUS">
      <div className="not-sidebar__head">
        <h2 className="not-sidebar__title">
          <b>Baza wiedzy NEXUS</b> · tylko odczyt
        </h2>
        <span className="chip not-chip">{docs.length}</span>
      </div>

      <input
        className="input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Szukaj w bazie NEXUS…"
        aria-label="Filtruj bazę NEXUS"
      />

      {error ? (
        <p className="not-state">{error}</p>
      ) : docs.length === 0 ? (
        <p className="not-state">Brak dokumentów NEXUS</p>
      ) : visible.length === 0 ? (
        <p className="not-state">Brak wyników</p>
      ) : (
        <ul className="not-tree">
          {folders.map((folder) => {
            const open =
              toggled[folder.key] ??
              (forceOpen || folder.docs.some((doc) => doc.path === selectedPath));
            return (
              <li key={folder.key} className="not-folder">
                <button
                  type="button"
                  className="not-folder__name"
                  aria-expanded={open}
                  onClick={() => setToggled((prev) => ({ ...prev, [folder.key]: !open }))}
                >
                  <span>
                    {open ? "▾" : "▸"} {folder.label}
                  </span>
                  <span className="muted">{folder.docs.length}</span>
                </button>
                {open ? (
                  <ul className="not-files">
                    {folder.docs.map((doc) => {
                      const isActive = doc.path === selectedPath;
                      return (
                        <li key={doc.path}>
                          <button
                            type="button"
                            onClick={() => onSelect(doc.path)}
                            className={cn("not-file", isActive && "not-file--active")}
                            aria-current={isActive ? "page" : undefined}
                            title={doc.path}
                          >
                            <span className="not-file__name">{doc.title}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {tags.length > 0 ? (
        <div className="not-tags-sec">
          <h3 className="not-tags-title">Tagi NEXUS</h3>
          <div className="not-tags-wrap">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={cn("chip", activeTag === tag && "chip--accent")}
                aria-pressed={activeTag === tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Dopisz style na końcu `src/features/notes/notes.css`**

```css
/* ── Baza wiedzy NEXUS (tylko odczyt) ───────────────────────────────────────── */
.not-nexus {
  margin-top: var(--s-4);
  padding-top: var(--s-3);
  border-top: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  gap: var(--s-2);
}
.not-nexus .not-folder__name {
  width: 100%;
  background: none;
  border: 0;
  padding: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.not-wikilink {
  color: var(--accent);
  text-decoration: underline dotted;
  cursor: pointer;
}
.not-wikilink--missing {
  color: var(--muted);
  text-decoration: none;
  cursor: help;
  opacity: 0.7;
}
```

- [ ] **Step 5: Uruchom — zielony**

Run: `npx vitest run tests/unit/features/notes/NexusDocsSection.test.tsx`
Expected: PASS (7 testów).

- [ ] **Step 6: Commit**

```bash
git add src/features/notes/NexusDocsSection.tsx src/features/notes/notes.css tests/unit/features/notes/NexusDocsSection.test.tsx
git commit -m "feat(notatki): sekcja Baza wiedzy NEXUS (drzewo, wyszukiwanie, tagi)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 11: `NexusDocView`

**Files:**

- Create: `src/features/notes/NexusDocView.tsx`
- Test: `tests/unit/features/notes/NexusDocView.test.tsx`

- [ ] **Step 1: Napisz test**

```tsx
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexusDocView } from "@/src/features/notes/NexusDocView";

afterEach(() => cleanup());

const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;

const docs = [
  { path: "Knowledge/a.md", area: "Knowledge" as const, group: "", title: "A", tags: [] },
  { path: "Knowledge/b.md", area: "Knowledge" as const, group: "", title: "B", tags: [] },
];

const DOC = {
  ...docs[0],
  frontmatter: [
    { key: "title", value: "A" },
    { key: "tags", value: "[x, y]" },
  ],
  body: "Zobacz [[Knowledge/b]] i [[Nieznany]] oraz **gruby**.",
};

describe("NexusDocView", () => {
  it("pokazuje plakietkę tylko do odczytu i jedną zakładkę Podgląd", async () => {
    const apiFetch = vi.fn(async () => json(DOC));
    const { findByText, getAllByRole, getByTestId } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={vi.fn()} />
    );
    await findByText("A", { selector: "h1" });
    expect(getByTestId("nexus-readonly-badge").textContent).toBe("tylko odczyt");
    const tabs = getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Podgląd"]);
  });

  it("renderuje kartę frontmattera i Markdown", async () => {
    const apiFetch = vi.fn(async () => json(DOC));
    const { container, findByText } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={vi.fn()} />
    );
    await findByText("A", { selector: "h1" });
    const fm = container.querySelector(".not-frontmatter");
    expect(fm?.textContent).toContain("tags: [x, y]");
    expect(container.querySelector("strong")?.textContent).toBe("gruby");
  });

  it("znany wikilink prowadzi do dokumentu (onNavigate), nieznany jest wyszarzony", async () => {
    const onNavigate = vi.fn();
    const apiFetch = vi.fn(async () => json(DOC));
    const { container, findByText } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={onNavigate} />
    );
    await findByText("A", { selector: "h1" });
    const link = container.querySelector('a[data-nexus-path="Knowledge/b.md"]') as HTMLElement;
    fireEvent.click(link);
    expect(onNavigate).toHaveBeenCalledWith("Knowledge/b.md");
    const missing = container.querySelector(".not-wikilink--missing");
    expect(missing?.textContent).toBe("Nieznany");
    expect(missing?.getAttribute("title")).toBe("poza bazą NEXUS w tym panelu");
    fireEvent.click(missing as HTMLElement);
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("surowy HTML w treści jest escapowany", async () => {
    const apiFetch = vi.fn(async () =>
      json({ ...DOC, frontmatter: [], body: "<script>alert(1)</script>" })
    );
    const { container, findByText } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={vi.fn()} />
    );
    await findByText("A", { selector: "h1" });
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector(".not-frontmatter")).toBeNull();
  });

  it("błąd odczytu pokazuje komunikat", async () => {
    const apiFetch = vi.fn(async () => json({ error: "nie ma" }, false));
    const { findByText } = render(
      <NexusDocView apiFetch={apiFetch} path="Knowledge/a.md" docs={docs} onNavigate={vi.fn()} />
    );
    await waitFor(async () => expect(await findByText("Dokument jest niedostępny")).toBeTruthy());
  });
});
```

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/features/notes/NexusDocView.test.tsx`
Expected: FAIL (brak modułu).

- [ ] **Step 3: Napisz `NexusDocView.tsx`**

```tsx
import React, { useMemo } from "react";
import type { NexusDocSummaryDto } from "@/contexts/bc_nexus_docs/schemas";
import { markdownToHtmlWithWikilinks } from "@/lib/markdown/wikilinks";
import { createNexusResolver } from "./nexusLinks";
import { useNexusDoc, type ApiFetch } from "./useNexusDocs";

export interface NexusDocViewProps {
  apiFetch: ApiFetch;
  path: string;
  /** Lista widocznych dokumentów: źródło dla resolvera wikilinków. */
  docs: NexusDocSummaryDto[];
  onNavigate: (path: string) => void;
}

/** Podgląd dokumentu NEXUS: wyłącznie odczyt, karta frontmattera, klikalne wikilinki. */
export function NexusDocView({ apiFetch, path, docs, onNavigate }: NexusDocViewProps) {
  const { doc: fetched, loading, error } = useNexusDoc(apiFetch, path);
  const doc = fetched && fetched.path === path ? fetched : null;
  const resolve = useMemo(() => createNexusResolver(docs.map((d) => d.path)), [docs]);
  const html = useMemo(
    () => (doc ? markdownToHtmlWithWikilinks(doc.body, resolve) : ""),
    [doc, resolve]
  );

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const link = (e.target as HTMLElement).closest("a[data-nexus-path]");
    if (!link) return;
    e.preventDefault();
    const target = link.getAttribute("data-nexus-path");
    if (target) onNavigate(target);
  };

  return (
    <div className="not-editor-wrap">
      <div className="not-toolbar">
        <div className="not-toolbar__path">
          <span>NEXUS/</span>
          <b>{path}</b>
        </div>
        <div className="not-toolbar__tools">
          <span className="chip not-chip chip--ok" data-testid="nexus-readonly-badge">
            tylko odczyt
          </span>
          <div className="tabs not-tabs" role="tablist">
            <button type="button" className="tabs__btn not-tabs__btn" role="tab" aria-selected>
              Podgląd
            </button>
          </div>
        </div>
      </div>

      <article className="not-sheet">
        <div className="not-sheet__body">
          {loading ? (
            <p className="not-state">Wczytywanie…</p>
          ) : error ? (
            <p className="not-state">{error}</p>
          ) : doc ? (
            <>
              {doc.frontmatter.length > 0 ? (
                <div className="not-frontmatter">
                  <div className="not-frontmatter__top">
                    <span>--- FRONTMATTER ---</span>
                    <span>NEXUS</span>
                  </div>
                  {doc.frontmatter.map((line) => (
                    <div key={line.key}>
                      {line.key}: {line.value}
                    </div>
                  ))}
                </div>
              ) : null}
              <h1 className="not-h1">{doc.title}</h1>
              <div
                className="not-prose"
                onClick={onClick}
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </>
          ) : null}
        </div>
      </article>
    </div>
  );
}
```

- [ ] **Step 4: Uruchom — zielony**

Run: `npx vitest run tests/unit/features/notes/NexusDocView.test.tsx`
Expected: PASS (5 testów). Uwaga na test „błąd odczytu”: `findByText` już czeka, więc `waitFor` jest zbędny; jeśli lint krzyczy, uprość do `await findByText("Dokument jest niedostępny")`.

- [ ] **Step 5: Commit**

```bash
git add src/features/notes/NexusDocView.tsx tests/unit/features/notes/NexusDocView.test.tsx
git commit -m "feat(notatki): podgląd dokumentu NEXUS z kartą frontmattera i wikilinkami

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Integracja w `NotesPanel` i `PlanowanieView`

**Files:**

- Modify: `src/features/notes/NotesPanel.tsx`
- Modify: `src/features/planowanie/PlanowanieView.tsx` (jedna linia: `apiFetch={apiFetch}`)
- Test: `tests/unit/features/notes/NotesPanel.nexus.test.tsx` (nowy plik; istniejące `NotesPanel.test.tsx` zostaje bez zmian i musi przejść)

- [ ] **Step 1: Napisz test integracyjny**

```tsx
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

import { NotesPanel, type NotesPanelProps } from "@/src/features/notes/NotesPanel";

afterEach(() => cleanup());

const json = (body: unknown, ok = true) =>
  ({ ok, status: ok ? 200 : 404, json: async () => body }) as Response;

const LIST = [
  { path: "Knowledge/a.md", area: "Knowledge", group: "", title: "Alfa NEXUS", tags: ["db"] },
  { path: "Knowledge/b.md", area: "Knowledge", group: "", title: "Beta NEXUS", tags: [] },
];
const DOCS: Record<string, unknown> = {
  "Knowledge/a.md": {
    ...LIST[0],
    frontmatter: [{ key: "tags", value: "[db]" }],
    body: "Zobacz [[Knowledge/b]] oraz [[Nieznany]].",
  },
  "Knowledge/b.md": { ...LIST[1], frontmatter: [], body: "Treść B" },
};

const apiFetch = vi.fn(async (url: string) => {
  if (url === "/api/nexus-docs") return json(LIST);
  const doc = DOCS[url.replace("/api/nexus-docs/", "")];
  return doc ? json(doc) : json({ error: "nie ma" }, false);
});

const note = {
  id: "n1",
  title: "Moja notatka",
  content: "treść",
  created_at: "2026-03-02T10:00:00.000Z",
};

const props = (over: Partial<NotesPanelProps> = {}): NotesPanelProps => ({
  notes: [note],
  selectedNote: null,
  setSelectedNote: vi.fn(),
  noteEditMode: false,
  setNoteEditMode: vi.fn(),
  onSaveNote: vi.fn(async () => {}),
  onDeleteNote: vi.fn(),
  newNote: "Nowa notatka",
  noteTitlePlaceholder: "Tytuł",
  noteContentPlaceholder: "Zacznij pisać",
  noteCancelEdit: "Anuluj",
  saveNote: "Zapisz",
  noteEdit: "Edytuj",
  deleteNote: "Usuń",
  apiFetch,
  ...over,
});

beforeEach(() => apiFetch.mockClear());

async function openDoc(utils: ReturnType<typeof render>, title: string) {
  fireEvent.change(await utils.findByLabelText("Filtruj bazę NEXUS"), {
    target: { value: title },
  });
  fireEvent.click(await utils.findByText(title, { selector: ".not-nexus .not-file__name" }));
}

describe("NotesPanel: baza wiedzy NEXUS", () => {
  it("bez apiFetch sekcji NEXUS nie ma", () => {
    const { queryByLabelText } = render(<NotesPanel {...props({ apiFetch: undefined })} />);
    expect(queryByLabelText("Baza wiedzy NEXUS")).toBeNull();
  });

  it("pokazuje sekcję NEXUS obok sekcji Notatki", async () => {
    const utils = render(<NotesPanel {...props()} />);
    expect(await utils.findByLabelText("Baza wiedzy NEXUS")).toBeTruthy();
    expect(utils.container.querySelector(".not-nexus .not-chip")?.textContent).toBe("2");
    expect(utils.getByLabelText("Filtruj notatki")).toBeTruthy();
  });

  it("wybór dokumentu NEXUS: odczyt, brak edycji, zapisu i usuwania, setSelectedNote(null)", async () => {
    const p = props({ selectedNote: note });
    const utils = render(<NotesPanel {...p} />);
    await openDoc(utils, "Alfa");
    expect(await utils.findByTestId("nexus-readonly-badge")).toBeTruthy();
    expect(p.setSelectedNote).toHaveBeenCalledWith(null);
    expect(p.setNoteEditMode).toHaveBeenCalledWith(false);
    expect(utils.queryByRole("tab", { name: "Edycja" })).toBeNull();
    expect(utils.queryByRole("tab", { name: "Split" })).toBeNull();
    expect(utils.queryByRole("button", { name: /Zapisz/ })).toBeNull();
    expect(utils.queryByRole("button", { name: "Usuń" })).toBeNull();
    expect(utils.queryByRole("button", { name: "Edytuj" })).toBeNull();
    expect(utils.container.querySelector(".not-frontmatter")?.textContent).toContain("tags: [db]");
  });

  it("kolumna metadanych pokazuje ścieżkę i tagi dokumentu NEXUS", async () => {
    const utils = render(<NotesPanel {...props()} />);
    await openDoc(utils, "Alfa");
    await utils.findByTestId("nexus-readonly-badge");
    const kv = utils.container.querySelector(".not-kv")?.textContent ?? "";
    expect(kv).toContain("Knowledge/a.md");
    expect(kv).toContain("#db");
  });

  it("klik w znany wikilink przełącza dokument, nieznany jest wyszarzony", async () => {
    const utils = render(<NotesPanel {...props()} />);
    await openDoc(utils, "Alfa");
    const link = await waitFor(() => {
      const el = utils.container.querySelector('a[data-nexus-path="Knowledge/b.md"]');
      expect(el).not.toBeNull();
      return el as HTMLElement;
    });
    expect(utils.container.querySelector(".not-wikilink--missing")?.textContent).toBe("Nieznany");
    fireEvent.click(link);
    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith("/api/nexus-docs/Knowledge/b.md"));
    expect(await utils.findByText("Treść B")).toBeTruthy();
  });

  it("wybór notatki zeruje wybór NEXUS", async () => {
    const p = props();
    const utils = render(<NotesPanel {...p} />);
    await openDoc(utils, "Alfa");
    await utils.findByTestId("nexus-readonly-badge");
    fireEvent.click(utils.getByText("Moja notatka", { selector: ".not-file__name" }));
    expect(p.setSelectedNote).toHaveBeenLastCalledWith(note);
    expect(utils.queryByTestId("nexus-readonly-badge")).toBeNull();
  });

  it("„Nowa notatka” zeruje wybór NEXUS", async () => {
    const utils = render(<NotesPanel {...props()} />);
    await openDoc(utils, "Alfa");
    await utils.findByTestId("nexus-readonly-badge");
    fireEvent.click(utils.getByRole("button", { name: /Nowa notatka/ }));
    expect(utils.queryByTestId("nexus-readonly-badge")).toBeNull();
  });
});
```

- [ ] **Step 2: Uruchom — czerwony**

Run: `npx vitest run tests/unit/features/notes/NotesPanel.nexus.test.tsx`
Expected: FAIL (brak propsu `apiFetch` i sekcji).

- [ ] **Step 3: Zmień `NotesPanel.tsx` (osiem edycji)**

(a) Importy: po `import { cn } from "@/src/lib/cn";` dopisz

```tsx
import { NexusDocsSection } from "./NexusDocsSection";
import { NexusDocView } from "./NexusDocView";
import { useNexusDocs, type ApiFetch } from "./useNexusDocs";
```

(b) W `NotesPanelProps`, po `inboxOpen?: number | null;` dopisz

```tsx
  /** Gdy podane, panel pokazuje sekcję „Baza wiedzy NEXUS” (tylko odczyt). */
  apiFetch?: ApiFetch;
```

(c) W destrukturyzacji propsów, po `inboxOpen = null,` dopisz `apiFetch,`.

(d) Po `const [split, setSplit] = useState(false);` dopisz

```tsx
const [nexusPath, setNexusPath] = useState<string | null>(null);
const nexus = useNexusDocs(apiFetch);
const nexusDoc = useMemo(
  () => nexus.docs.find((d) => d.path === nexusPath) ?? null,
  [nexus.docs, nexusPath]
);

const selectNexus = (path: string) => {
  setNexusPath(path);
  setSelectedNote(null);
  setNoteEditMode(false);
};
```

(e) W `handleCreateNew` dopisz jako pierwszą linię ciała `setNexusPath(null);`. W handlerze kliku notatki na liście (blok `onClick={() => { setSelectedNote(note); setNoteEditMode(false); }}`) dopisz `setNexusPath(null);` przed `setSelectedNote(note);`.

(f) Przycisk zapisu w nagłówku (blok `<button type="button" onClick={onSaveNote} disabled={!editing} className="btn btn--primary not-btn--primary">…</button>`) opakuj: `{nexusPath === null && ( …ten przycisk… )}`.

(g) Sekcja w lewej kolumnie: tuż przed `</aside>` po bloku `<div className="not-tags-sec">…</div>` (czyli bezpośrednio przed linią `        </aside>` poprzedzającą `<main className="not-editor-col">`) wstaw

```tsx
{
  apiFetch ? (
    <NexusDocsSection
      docs={nexus.docs}
      error={nexus.error}
      selectedPath={nexusPath}
      onSelect={selectNexus}
    />
  ) : null;
}
```

(h) Kolumna środkowa i metadane. W `<main className="not-editor-col">` zamień otwarcie warunku `{selectedNote ? (` na

```tsx
          {nexusPath !== null && apiFetch ? (
            <NexusDocView
              apiFetch={apiFetch}
              path={nexusPath}
              docs={nexus.docs}
              onNavigate={selectNexus}
            />
          ) : selectedNote ? (
```

W kolumnie metadanych zamień `{selectedNote ? (\n              <dl className="not-kv">` (pierwsze wystąpienie z `Utworzono`) tak, by dodać gałąź przed nią:

```tsx
            {nexusDoc ? (
              <dl className="not-kv">
                <dt>Ścieżka</dt>
                <dd>{nexusDoc.path}</dd>
                <dt>Obszar</dt>
                <dd>{nexusDoc.group ? `${nexusDoc.area} / ${nexusDoc.group}` : nexusDoc.area}</dd>
                <dt>Tagi</dt>
                <dd>
                  {nexusDoc.tags.length > 0 ? nexusDoc.tags.map((t) => `#${t}`).join(" ") : "—"}
                </dd>
              </dl>
            ) : selectedNote ? (
```

(Reszta gałęzi `selectedNote ? <dl>…</dl> : <p>Wybierz notatkę</p>` zostaje bez zmian.)

- [ ] **Step 4: Przekaż `apiFetch` w `PlanowanieView.tsx`**

W `<NotesPanel … inboxOpen={inboxOpen} />` dopisz po `inboxOpen={inboxOpen}` linię `apiFetch={apiFetch}`.

- [ ] **Step 5: Uruchom nowe i istniejące testy panelu**

Run: `npx vitest run tests/unit/features/notes tests/unit/features/planowanie`
Expected: PASS, w tym niezmienione `NotesPanel.test.tsx`. Jeśli test planowania sprawdza propsy `NotesPanel` na sztywno, popraw oczekiwanie o `apiFetch` (to zmiana testu zależnego od nowego propsu, osobny commit nie jest wymagany, bo to nie `architecture.static.test.ts`).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: bez błędów.

- [ ] **Step 7: Commit**

```bash
git add src/features/notes/NotesPanel.tsx src/features/planowanie/PlanowanieView.tsx tests/unit/features/notes/NotesPanel.nexus.test.tsx
git commit -m "feat(notatki): baza wiedzy NEXUS w panelu Notatki (tylko odczyt)

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Weryfikacja końcowa i review

- [ ] **Step 1: Pełny zestaw przez cursora (podsumowanie zamiast pełnego outputu)**

```bash
scripts/ask-helper.sh --role task --approve-allowed --tier light --fresh --timeout 900 cursor "W katalogu Monolith uruchom po kolei: 'npx tsc --noEmit', 'npm run lint', 'npx vitest run', 'npm run build'. Nic nie edytuj. Odpowiedz krótko: 'przeszło' albo lista plik:linia + przyczyna dla każdej porażki oraz liczba testów (passed/failed)."
```

Expected: wszystkie cztery przeszły. Porażka → napraw kodem (nie testem architektury), powtórz.

- [ ] **Step 2: Review diffa przez agy (głębszy model, niezależny kontekst)**

```bash
scripts/ask-helper.sh --role review --timeout 900 agy "Zrób review diffa 'git diff main...HEAD' (bez docs/). Spec: docs/superpowers/specs/2026-11-14-notatki-nexus-odczyt-design.md. Sprawdź: (1) czy jakakolwiek ścieżka kodu w contexts/bc_nexus_docs, app/api/nexus-docs lub nowych plikach UI może zapisać do vaulta; (2) czy odczyt pliku spoza listy widocznych (D3, D9, Work na dowolnej głębokości, dowiązania) jest niemożliwy; (3) XSS: wtyczka lib/markdown/wikilinks.ts i dangerouslySetInnerHTML w NexusDocView; (4) zgodność z regułami architektury R1-R7 z CLAUDE.md. Odpowiedz listą 'plik:linia + problem + powaga' albo 'brak uwag'."
```

Opinie traktuj jak hipotezy: zweryfikuj w kodzie, zanim cokolwiek zmienisz.

- [ ] **Step 3: Ręczna kontrola w aplikacji (skill `run`)**

Uruchom aplikację, otwórz Alt+5 (Notatki): sekcja „Baza wiedzy NEXUS · tylko odczyt” pod listą notatek; rozwiń `Knowledge/…`, otwórz dokument z wikilinkami; kliknij znany wikilink (zmienia dokument) i nieznany (szary, bez reakcji); wybierz zwykłą notatkę (wraca edytor z zakładkami Podgląd/Edycja/Split); `curl -i localhost:<port>/api/nexus-docs/Work/x.md` → 400, `…/Projects/<id>/state.md` → 404, `curl -X PUT` na `/api/nexus-docs` → 405.

- [ ] **Step 4: Domknięcie gałęzi**

Użyj skilla `finishing-a-development-branch` (PR do `main`, merge po zgodzie użytkownika).

---

## Self-review (spec → zadania)

| Wymaganie specu                                                                     | Zadanie                         |
| ----------------------------------------------------------------------------------- | ------------------------------- |
| D1 tylko odczyt; gwarancja strukturalna (§1 pkt 3)                                  | 1, 2, 4, 6                      |
| D2/D3 zakres, wyłączenia, kształt `Projects/<id>/<plik>.md`, 404 przy odczycie      | 5 (`isVisiblePath`, `getDoc`)   |
| D9 projekty z rejestru bez `owner: work`, tylko przez `bc_projects/services`        | 5                               |
| D8 wpis `VAULT_FS_IMPORTERS` osobnym commitem przed kodem + test statyczny §7 pkt 8 | 1, 2                            |
| D4 nowy kontekst, pięć plików                                                       | 3–6                             |
| D5 resolver po stronie klienta                                                      | 8                               |
| D6 wtyczka wikilinków, `html: false` bez zmian                                      | 7                               |
| D7 lista w jednym zapytaniu, treść po otwarciu                                      | 5, 9                            |
| §3 tytuł (title > name > `#` > plik), tagi, `group`, 413, lista = zgoda na odczyt   | 5                               |
| §3 R3/R4: walidacja w services, `route.ts` tylko re-eksport                         | 5, 6                            |
| §4 API, kolejność 400 → 404 → 413, `Work/x.md` daje 400                             | 5, 6                            |
| §5 UI: sekcja, widok, hooki, lokalny `nexusPath`, tylko Podgląd, wikilink, szarość  | 8–12                            |
| §5 teksty UI w `translations.ts`                                                    | **odstępstwo opisane na górze** |
| §6 bezpieczeństwo (escape atrybutu, brak celu w `href`, `html: false`)              | 7, 11                           |
| §7 pkt 1–8 testy                                                                    | 2, 4, 5, 6, 7, 8, 10, 11, 12    |

Spójność nazw: `listNexusPaths`/`readNexusDoc` (repo) → `listDocs`/`getDoc`/`parseDocPath`/`isVisiblePath` (services) → `listNexusDocs`/`getNexusDoc` (router) → `createNexusResolver`, `filterNexusDocs`, `groupNexusDocs`, `collectNexusTags` (UI), `markdownToHtmlWithWikilinks`/`wikilinksPlugin`/`createMarkdown` (markdown), `useNexusDocs`/`useNexusDoc`, `NexusDocsSection`, `NexusDocView`, `data-testid="nexus-readonly-badge"` (używany w testach Task 11 i 12).
